// Admin actions on payslip batches: manual match, distribute, delete slip.
// distribute_batch encrypts each staged (plain) PDF with the employee's last-6-CNP password.
import { createClient } from "@supabase/supabase-js";
import { encryptPDF } from "pdf-encrypt";


const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}


// One bounded chunk: encrypt + publish up to chunk_size slips.
// deno-lint-ignore no-explicit-any
async function distributeChunk(admin: any, batch_id: string, userId: string, chunk_size: unknown) {

            const effectiveChunk = Math.max(1, Math.min(50, Number(chunk_size) || 15));

      // Fetch remaining eligible slips (not yet encrypted)
      const { data: slips } = await admin
        .from("payslips")
        .select("id, file_path, match_status, employee_epd_id, file_path_encrypted")
        .eq("batch_id", batch_id)
        .is("file_path_encrypted", null);
      const eligibleAll = (slips ?? []).filter((s: any) =>
        s.file_path && s.employee_epd_id &&
        (s.match_status === "matched" || s.match_status === "needs_confirm"),
      );

      // Total remaining before this run
      const totalRemainingBefore = eligibleAll.length;

      if (totalRemainingBefore === 0) {
        // Nothing left — finalize batch if not already
        const now = new Date().toISOString();
        await admin.from("payslip_batches").update({ status: "distributed", distributed_at: now }).eq("id", batch_id);
        return { ok: true, done: true, processed: 0, remaining: 0, distributed: 0, failures: [] };
      }

      const chunk = eligibleAll.slice(0, effectiveChunk);
      const encryptFailures: Array<{ id: string; error: string }> = [];
      const encryptedIds: string[] = [];
      const now = new Date().toISOString();

      // Preload CNP + account link for the whole chunk in one query.
      const epdIds = (chunk as any[]).map((s) => s.employee_epd_id);
      const { data: epdRows } = await admin
        .from("employee_personal_data")
        .select("id, cnp, employee_record_id")
        .in("id", epdIds);
      const epdMap = new Map((epdRows ?? []).map((r: any) => [r.id, r]));
      const recIds = (epdRows ?? []).map((r: any) => r.employee_record_id).filter(Boolean);
      const { data: recRows } = recIds.length
        ? await admin.from("employee_records").select("id, user_id").in("id", recIds)
        : { data: [] as any[] };
      const recMap = new Map((recRows ?? []).map((r: any) => [r.id, r.user_id]));

      const processOne = async (s: any) => {
        try {
          const epd: any = epdMap.get(s.employee_epd_id);
          const cnp = ((epd?.cnp as string | null) ?? "").replace(/\D/g, "");
          if (cnp.length < 6) throw new Error("CNP lipsă/prea scurt");
          const password = cnp.slice(-6);

          const { data: blob, error: dlErr } = await admin.storage
            .from("payslips").download(s.file_path);
          if (dlErr || !blob) throw new Error(dlErr?.message ?? "download failed");
          const plainBytes = new Uint8Array(await blob.arrayBuffer());

          const encPath = s.file_path.replace(/\.pdf$/i, "") + ".enc.pdf";
          const outBytes = await Promise.race([
            encryptPDF(plainBytes, password, {
              ownerPassword: crypto.randomUUID().replace(/-/g, ""),
              algorithm: "AES-256",
              allowPrinting: true,
              allowHighQualityPrint: true,
              allowCopying: false,
              allowModifying: false,
              allowAnnotating: false,
              allowFillingForms: false,
              allowExtraction: false,
              allowAssembly: false,
            }),
            new Promise<never>((_, rej) =>
              setTimeout(() => rej(new Error("Timeout criptare (20s)")), 20000)
            ),
          ]) as Uint8Array;

          const head2 = new TextDecoder("latin1").decode(outBytes.subarray(0, Math.min(outBytes.length, 200000)));
          if (!/\/Encrypt\b/.test(head2)) throw new Error("Rezultat necriptat");
          const { error: upErr } = await admin.storage
            .from("payslips")
            .upload(encPath, outBytes, { contentType: "application/pdf", upsert: true });
          if (upErr) throw new Error(upErr.message);

          await admin.from("payslips").update({
            match_status: "distributed",
            distributed_at: now,
            file_path_encrypted: encPath,
          }).eq("id", s.id);

          try {
            const uid = epd?.employee_record_id ? recMap.get(epd.employee_record_id) : null;
            if (uid) {
              await admin.from("notifications").insert({
                user_id: uid,
                title: "Fluturaș nou disponibil",
                message: "Aveți un fluturaș nou în profil. Parola este ultimele 6 cifre din CNP.",
                type: "info",
                related_type: "payslip",
                related_id: s.id,
              });
            }
          } catch (_) { /* non-fatal */ }

          encryptedIds.push(s.id);
        } catch (e) {
          encryptFailures.push({ id: s.id, error: (e as Error).message });
        }
      };

      // Process a few slips at once instead of strictly one by one.
      const PARALLEL = 5;
      const list = chunk as any[];
      for (let i = 0; i < list.length; i += PARALLEL) {
        await Promise.all(list.slice(i, i + PARALLEL).map(processOne));
      }

      const remaining = totalRemainingBefore - encryptedIds.length - encryptFailures.length;
      const done = remaining <= 0;
      if (done) {
        await admin.from("payslip_batches").update({ status: "distributed", distributed_at: now }).eq("id", batch_id);
      }

      await admin.from("payslip_audit_log").insert({
        user_id: userId, batch_id, action: done ? "distribute" : "distribute_chunk",
        details: { processed: encryptedIds.length, failures: encryptFailures, remaining },
      });

      return {
        ok: true,
        done,
        processed: encryptedIds.length,
        remaining,
        distributed: encryptedIds.length,
        failures: encryptFailures,
      };
    }

const BG_BUDGET_MS = 100_000;
const BG_MAX_HOPS = 40;
const BG_COOLDOWN_MS = 2_000;

// Background loop: runs chunks until done or budget spent, then re-invokes itself (bounded by hops).
// deno-lint-ignore no-explicit-any
async function distributeInBackground(admin: any, batch_id: string, userId: string, hopsLeft: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const started = Date.now();
  let failStreak = 0;
  while (Date.now() - started < BG_BUDGET_MS) {
    try {
      const r = await distributeChunk(admin, batch_id, userId, 5);
      failStreak = 0;
      if (r.done) {
        await fetch(`${supabaseUrl}/functions/v1/notify-payslip-distributed`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ batch_id, run_all: true }),
        }).then((x) => x.text()).catch((e) => console.error("notify start failed", e));
        return;
      }
      // Stop if a whole chunk failed (nothing progressed) to avoid looping on broken slips.
      if (r.processed === 0) return;
    } catch (e) {
      console.error("bg chunk error", e);
      if (++failStreak >= 3) {
        await admin.from("payslip_audit_log").insert({
          user_id: userId, batch_id, action: "distribute_failed", details: { error: (e as Error).message },
        });
        return;
      }
      await new Promise((r) => setTimeout(r, 3000 * failStreak));
    }
  }
  if (hopsLeft <= 0) return;
  await new Promise((r) => setTimeout(r, BG_COOLDOWN_MS));
  await fetch(`${supabaseUrl}/functions/v1/payslip-batch-action`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "distribute_continue", batch_id, actor_id: userId, hops_left: hopsLeft - 1 }),
  }).then((x) => x.text()).catch((e) => console.error("continue failed", e));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Nu ești autentificat" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.slice(7);
    if (token === serviceKey) {
      const body = await req.json();
      if (body?.action !== "distribute_continue" || !body.batch_id || !body.actor_id) return jsonResp({ error: "params" }, 400);
      const svc = createClient(supabaseUrl, serviceKey);
      // @ts-ignore EdgeRuntime is provided by the edge runtime
      EdgeRuntime.waitUntil(distributeInBackground(svc, body.batch_id, body.actor_id, Math.max(0, Math.min(BG_MAX_HOPS, Number(body.hops_left) || 0))));
      return jsonResp({ ok: true });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    if (!userData?.user) return jsonResp({ error: "Sesiune invalidă" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isAdmin = roleSet.has("super_admin") || roleSet.has("salarizare");
    if (!isAdmin) return jsonResp({ error: "Nu ai permisiuni" }, 403);

    const { action, payslip_id, employee_epd_id, batch_id, chunk_size } = await req.json();

    if (action === "assign") {
      if (!payslip_id || !employee_epd_id) return jsonResp({ error: "params" }, 400);
      // Just link; encryption/upload was already done if matched previously.
      // For unmatched slips (no file), we do NOT auto-encrypt now — admin should re-upload the batch.
      await admin.from("payslips")
        .update({ employee_epd_id, match_status: "needs_confirm", match_notes: "Asociat manual — necesită re-procesare pentru criptare" })
        .eq("id", payslip_id);
      await admin.from("payslip_audit_log").insert({
        user_id: userId, payslip_id, action: "manual_assign",
      });
      return jsonResp({ ok: true });
    }

    if (action === "distribute_batch") {
      if (!batch_id) return jsonResp({ error: "batch_id" }, 400);
      return jsonResp(await distributeChunk(admin, batch_id, userId, chunk_size));
    }

    if (action === "distribute_background") {
      if (!batch_id) return jsonResp({ error: "batch_id" }, 400);
      // @ts-ignore EdgeRuntime is provided by the edge runtime
      EdgeRuntime.waitUntil(distributeInBackground(admin, batch_id, userId, BG_MAX_HOPS));
      return jsonResp({ ok: true, started: true });
    }

    if (action === "delete_batch") {
      if (!batch_id) return jsonResp({ error: "batch_id" }, 400);
      // Delete storage files
      const { data: slips } = await admin
        .from("payslips").select("file_path").eq("batch_id", batch_id);
      const paths = (slips ?? []).map((s: any) => s.file_path).filter(Boolean);
      if (paths.length) await admin.storage.from("payslips").remove(paths);
      await admin.from("payslip_batches").delete().eq("id", batch_id);
      await admin.from("payslip_audit_log").insert({
        user_id: userId, batch_id, action: "delete", details: { removed_files: paths.length },
      });
      return jsonResp({ ok: true });
    }

    return jsonResp({ error: "Acțiune necunoscută" }, 400);
  } catch (e) {
    console.error("payslip-batch-action error", e);
    return jsonResp({ error: (e as Error).message }, 500);
  }
});
