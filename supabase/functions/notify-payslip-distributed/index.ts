// Sends an email notification to every employee who received a payslip in a batch.
// Chunked: call repeatedly until { done: true }. Never attaches the payslip itself.
import nodemailer from "nodemailer";
import { sendMailWithRetry } from "../_shared/smtp-retry.ts";
import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function buildHtml(periodLabel: string, firstName: string) {
  const greeting = firstName ? `Bună ziua, ${firstName},` : "Bună ziua,";
  return `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1a202c; line-height: 1.6;">
  <div style="border-bottom: 2px solid #1F4E79; padding-bottom: 14px; margin-bottom: 22px;">
    <h1 style="color:#1F4E79; margin:0; font-size: 21px;">Fluturașul de salariu pentru ${periodLabel} este disponibil</h1>
    <p style="color:#6b7280; margin: 6px 0 0; font-size: 13px;">Intranet ICMPP — modul Salarizare</p>
  </div>

  <p style="margin-top:0;">${greeting}</p>

  <p>Fluturașul dumneavoastră de salariu pentru <strong>${periodLabel}</strong> a fost încărcat și este disponibil în Intranet, în profilul personal, secțiunea <strong>„Fluturașii mei”</strong>.</p>

  <div style="background:#f1f5f9; border-left: 4px solid #1F4E79; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
    <p style="margin:0 0 8px;"><strong>Cum îl accesați</strong></p>
    <ol style="margin:0; padding-left: 18px;">
      <li>Intrați în Intranet și autentificați-vă cu contul instituțional.</li>
      <li>Deschideți <em>Profilul meu</em> și mergeți la secțiunea <em>„Fluturașii mei”</em>.</li>
      <li>Descărcați documentul aferent lunii ${periodLabel}.</li>
    </ol>
    <p style="margin:12px 0 0;">Documentul este protejat cu parolă: <strong>ultimele 6 cifre din CNP</strong>.</p>
  </div>

  <p style="text-align:center; margin: 26px 0;">
    <a href="https://intranet.icmpp.ro/my-profile" style="background:#1F4E79; color:#ffffff; text-decoration:none; padding: 12px 26px; border-radius: 6px; display:inline-block; font-weight:bold;">Deschide Fluturașii mei</a>
  </p>

  <p style="font-size: 13px; color:#4b5563;">Din motive de confidențialitate, fluturașul nu se transmite atașat pe e-mail — se accesează exclusiv din Intranet, după autentificare.</p>

  <p style="font-size: 13px; color:#4b5563;">Dacă documentul nu vă corespunde sau întâmpinați dificultăți, folosiți butonul de semnalare din secțiunea „Fluturașii mei” ori contactați Serviciul Salarizare.</p>

  <p style="color:#718096; font-size: 12px; margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
    Mesaj automat trimis de Intranet ICMPP. Vă rugăm să nu răspundeți la acest e-mail.
  </p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Nu ești autentificat" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const isServiceCall = token === serviceKey;
    let actorId: string | null = null;
    if (!isServiceCall) {
      const { data: userData } = await admin.auth.getUser(token);
      if (!userData?.user) return jsonResp({ error: "Sesiune invalidă" }, 401);
      actorId = userData.user.id;
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", actorId);
      const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));
      if (!(roleSet.has("super_admin") || roleSet.has("salarizare"))) {
        return jsonResp({ error: "Nu ai permisiuni" }, 403);
      }
    }


    const body = await req.json().catch(() => ({}));
    const batchId: string | undefined = body.batch_id;
    const testEmail: string | undefined = body.test_email;
    const chunkSize = Math.max(1, Math.min(60, Number(body.chunk_size) || 40));
    if (!batchId) return jsonResp({ error: "batch_id lipsește" }, 400);

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";
    if (!smtpHost || !smtpUser || !smtpPass) {
      return jsonResp({ error: "SMTP neconfigurat" }, 500);
    }
    const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"Intranet ICMPP" <${smtpUser}>`;

    const { data: batch } = await admin
      .from("payslip_batches").select("id, month, year").eq("id", batchId).maybeSingle();
    if (!batch) return jsonResp({ error: "Lotul nu există" }, 404);
    const periodLabel = `${MONTHS[(Number(batch.month) || 1) - 1]} ${batch.year}`;

    const transporter = nodemailer.createTransport({
      host: smtpHost, port: smtpPort, secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // Test mode: single email to the requester-provided address.
    if (testEmail) {
      await sendMailWithRetry(transporter, {
        from: fromAddress,
        to: testEmail,
        subject: `[TEST] Fluturașul de salariu pentru ${periodLabel} este disponibil în Intranet`,
        html: buildHtml(periodLabel, ""),
      }, { label: "payslip-distributed-test" });
      return jsonResp({ ok: true, test: true, sent_to: testEmail });
    }

    const offset = Math.max(0, Number(body.offset) || 0);

    const { data: slips } = await admin
      .from("payslips")
      .select("id, employee_epd_id")
      .eq("batch_id", batchId)
      .eq("match_status", "distributed")
      .is("email_notified_at", null)
      .order("id", { ascending: true });

    const pending = (slips ?? []).filter((s: { employee_epd_id: string | null }) => s.employee_epd_id);
    if (pending.length <= offset) {
      return jsonResp({ ok: true, done: true, sent: 0, skipped: 0, remaining: 0, failed: [], next_offset: offset, missing_email: [], invalid_email: [] });
    }

    const chunk = pending.slice(offset, offset + chunkSize);
    const epdIds = chunk.map((s: { employee_epd_id: string }) => s.employee_epd_id);
    const { data: people } = await admin
      .from("employee_personal_data")
      .select("id, email, first_name, last_name")
      .in("id", epdIds);
    const byId = new Map((people ?? []).map((p: { id: string }) => [p.id, p]));


    const now = new Date().toISOString();
    let sent = 0;
    const failed: Array<{ id: string; error: string }> = [];
    const skipped: string[] = [];
    const missingEmail: string[] = [];
    const invalidEmail: Array<{ email: string; name: string }> = [];

    for (const s of chunk as Array<{ id: string; employee_epd_id: string }>) {
      const person = byId.get(s.employee_epd_id) as { email?: string | null; first_name?: string | null; last_name?: string | null } | undefined;
      const fullName = `${(person?.last_name ?? "").trim()} ${(person?.first_name ?? "").trim()}`.trim();
      const email = (person?.email ?? "").trim();
      if (!email || !email.includes("@")) {
        // No usable address: do NOT mark as notified, so a corrected address gets the email later.
        skipped.push(s.id);
        missingEmail.push(fullName || s.employee_epd_id);
        continue;
      }
      try {
        await sendMailWithRetry(transporter, {
          from: fromAddress,
          to: email,
          subject: `Fluturașul de salariu pentru ${periodLabel} este disponibil în Intranet`,
          html: buildHtml(periodLabel, (person?.first_name ?? "").trim()),
        }, { label: "payslip-distributed" });
        await admin.from("payslips").update({ email_notified_at: now }).eq("id", s.id);
        sent++;
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        const code = (e as { responseCode?: number }).responseCode;
        const permanent = (typeof code === "number" && code >= 500) || /\b5\d\d\b/.test(msg) || /rejected|no such|not exist|valid mx|unrouteable|user unknown/i.test(msg);
        if (permanent) {
          // Bad address: stop retrying it, flag it for HR correction.
          await admin.from("payslips").update({ email_notified_at: now }).eq("id", s.id);
          invalidEmail.push({ email, name: fullName });
        } else {
          failed.push({ id: s.id, error: msg });
        }
      }
    }

    // The chunk is the tail of the pending list -> nothing left to process.
    const remaining = Math.max(0, pending.length - chunk.length);
    const done = remaining === 0;

    await admin.from("payslip_audit_log").insert({
      user_id: actorId,
      batch_id: batchId,
      action: done ? "email_notify" : "email_notify_chunk",
      details: {
        sent,
        skipped: skipped.length,
        failed: failed.length,
        remaining,
        missing_email: missingEmail,
        invalid_email: invalidEmail,
      },
    });

    return jsonResp({
      ok: true, done, sent,
      skipped: skipped.length,
      remaining, failed,
      missing_email: missingEmail,
      invalid_email: invalidEmail,
    });

  } catch (e) {
    console.error("notify-payslip-distributed error", e);
    return jsonResp({ error: "Eroare internă la trimiterea e-mailurilor." }, 500);
  }
});
