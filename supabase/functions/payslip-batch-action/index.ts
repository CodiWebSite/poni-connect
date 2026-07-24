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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Nu ești autentificat" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { action, payslip_id, employee_epd_id, batch_id } = await req.json();

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
      // Only slips that already have a file_path AND matched/needs_confirm become distributed
      const { data: slips } = await admin
        .from("payslips")
        .select("id, file_path, match_status, employee_epd_id")
        .eq("batch_id", batch_id);
      const eligible = (slips ?? []).filter((s: any) =>
        s.file_path && s.employee_epd_id && (s.match_status === "matched" || s.match_status === "needs_confirm"),
      );
      if (eligible.length === 0) return jsonResp({ error: "Niciun fluturaș eligibil pentru distribuție" }, 422);

      // Encrypt each staged plain PDF in place with the employee's last-6-CNP password.
      const encryptFailures: Array<{ id: string; error: string }> = [];
      const encryptedIds: string[] = [];
      for (const s of eligible as any[]) {
        try {
          const { data: epd } = await admin
            .from("employee_personal_data")
            .select("cnp")
            .eq("id", s.employee_epd_id)
            .maybeSingle();
          const cnp = ((epd?.cnp as string | null) ?? "").replace(/\D/g, "");
          if (cnp.length < 6) throw new Error("CNP lipsă/prea scurt");
          const password = cnp.slice(-6);

          const { data: blob, error: dlErr } = await admin.storage
            .from("payslips").download(s.file_path);
          if (dlErr || !blob) throw new Error(dlErr?.message ?? "download failed");
          const plainBytes = new Uint8Array(await blob.arrayBuffer());

          // If already encrypted (e.g. re-distribute), skip.
          const head = new TextDecoder("latin1").decode(plainBytes.subarray(0, Math.min(plainBytes.length, 200000)));
          let outBytes = plainBytes;
          if (!/\/Encrypt\b/.test(head)) {
            outBytes = await encryptPDF(plainBytes, password, {
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
            });
            const head2 = new TextDecoder("latin1").decode(outBytes.subarray(0, Math.min(outBytes.length, 200000)));
            if (!/\/Encrypt\b/.test(head2)) throw new Error("Rezultat necriptat");
            const { error: upErr } = await admin.storage
              .from("payslips")
              .upload(s.file_path, outBytes, { contentType: "application/pdf", upsert: true });
            if (upErr) throw new Error(upErr.message);
          }
          encryptedIds.push(s.id);
        } catch (e) {
          encryptFailures.push({ id: s.id, error: (e as Error).message });
        }
      }

      if (encryptedIds.length === 0) {
        return jsonResp({ error: "Criptarea a eșuat pentru toți fluturașii", failures: encryptFailures }, 500);
      }

      const now = new Date().toISOString();
      await admin.from("payslips").update({ match_status: "distributed", distributed_at: now }).in("id", encryptedIds);
      await admin.from("payslip_batches").update({ status: "distributed", distributed_at: now }).eq("id", batch_id);

      const eligibleForNotify = (eligible as any[]).filter(s => encryptedIds.includes(s.id));


      // In-app notification for each pilot employee whose payslip was distributed
      // Look up user_id via employee_records + pilot check
      for (const s of eligible) {
        const { data: epd } = await admin
          .from("employee_personal_data")
          .select("employee_record_id, first_name, last_name")
          .eq("id", s.employee_epd_id)
          .maybeSingle();
        if (!epd?.employee_record_id) continue;
        const { data: rec } = await admin
          .from("employee_records")
          .select("user_id")
          .eq("id", epd.employee_record_id)
          .maybeSingle();
        if (!rec?.user_id) continue;
        // pilot check
        const { data: uinfo } = await admin.auth.admin.getUserById(rec.user_id);
        const email = (uinfo.user?.email ?? "").toLowerCase();
        if (!email) continue;
        const { data: pilot } = await admin
          .from("payslip_pilot_users")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (!pilot) continue;
        await admin.from("notifications").insert({
          user_id: rec.user_id,
          title: "Fluturaș nou disponibil",
          message: "Aveți un fluturaș nou în profil. Parola este ultimele 6 cifre din CNP.",
          type: "info",
          related_type: "payslip",
          related_id: s.id,
        });
      }

      await admin.from("payslip_audit_log").insert({
        user_id: userId, batch_id, action: "distribute", details: { count: eligible.length },
      });
      return jsonResp({ ok: true, distributed: eligible.length });
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
