// Trimite e-mailurile din coada sigură (email_outbox). Fără date de intrare:
// procesează doar ce e deja în coadă, deci e sigur de apelat oricând.
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { sendMailWithRetry } from "../_shared/smtp-retry.ts";
import { logOpsFailure } from "../_shared/ops-log.ts";

const MAX_ATTEMPTS = 40; // ~ câteva zile de reîncercări

const fmt = (d: string) => {
  const [y, m, day] = String(d).slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
};
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: rows } = await admin
    .from("email_outbox")
    .select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at")
    .limit(20);
  if (!rows?.length) return new Response(JSON.stringify({ processed: 0 }));

  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpFrom = Deno.env.get("SMTP_FROM") || "";
  const from = smtpFrom.includes("@") ? smtpFrom : `"${smtpFrom}" <${smtpUser}>`;
  const transporter = nodemailer.createTransport({
    host: smtpHost, port: smtpPort, secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  let sent = 0;
  for (const row of rows) {
    try {
      if (!smtpHost || !smtpUser || !smtpPass) throw new Error("SMTP neconfigurat");
      if (row.kind !== "leave_hr_notice") throw new Error(`tip necunoscut ${row.kind}`);

      const { data: r } = await admin
        .from("leave_requests")
        .select("id, request_number, start_date, end_date, working_days, user_id, epd_id, dept_head_id")
        .eq("id", row.payload.request_id)
        .maybeSingle();
      if (!r) {
        await admin.from("email_outbox").update({ status: "cancelled", last_error: "cerere ștearsă" }).eq("id", row.id);
        continue;
      }

      let name: string | null = null;
      if (r.epd_id) {
        const { data: e } = await admin.from("employee_personal_data").select("last_name, first_name").eq("id", r.epd_id).maybeSingle();
        if (e) name = [e.last_name, e.first_name].filter(Boolean).join(" ") || null;
      }
      if (!name && r.user_id) {
        const { data: p } = await admin.from("profiles").select("full_name").eq("user_id", r.user_id).maybeSingle();
        name = p?.full_name ?? null;
      }
      let approver = "Șef compartiment";
      if (r.dept_head_id) {
        const { data: p } = await admin.from("profiles").select("full_name").eq("user_id", r.dept_head_id).maybeSingle();
        if (p?.full_name) approver = p.full_name;
      }

      const td = 'style="padding:8px 12px;border:1px solid #bee3f8;"';
      const th = 'style="padding:8px 12px;border:1px solid #bee3f8;font-weight:bold;"';
      const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#1a365d;border-bottom:2px solid #38a169;padding-bottom:10px;">Cerere de Concediu Aprobată — De Centralizat</h2>
        <p>Bună ziua,</p>
        <p>Cererea de concediu a angajatului <strong>${esc(name || "Angajat")}</strong> a fost aprobată de <strong>${esc(approver)}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:15px 0;">
          <tr><td ${th}>Nr. cerere</td><td ${td}>${esc(r.request_number)}</td></tr>
          <tr><td ${th}>Angajat</td><td ${td}>${esc(name || "—")}</td></tr>
          <tr><td ${th}>Perioada</td><td ${td}>${fmt(r.start_date)} — ${fmt(r.end_date)}</td></tr>
          <tr><td ${th}>Zile lucrătoare</td><td ${td}>${esc(r.working_days)}</td></tr>
          <tr><td ${th}>Aprobat de</td><td ${td}>${esc(approver)}</td></tr>
        </table>
        <p>Vă rugăm să centralizați această cerere în evidența concediilor.</p>
        <p style="color:#718096;font-size:12px;margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px;">Acest email a fost trimis automat de sistemul Intranet ICMPP. Nu răspundeți la acest mesaj.</p>
      </div>`;

      await sendMailWithRetry(transporter, {
        from, to: row.to_email,
        subject: `📋 Cerere concediu aprobată — ${name || "Angajat"} (${r.request_number})`,
        html,
      }, { maxAttempts: 2, label: "process-email-outbox" });

      await admin.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1, last_error: null }).eq("id", row.id);
      sent++;
    } catch (err) {
      const attempts = row.attempts + 1;
      const msg = (err as Error)?.message ?? String(err);
      const delayMin = Math.min(5 * 2 ** Math.min(attempts - 1, 6), 180);
      const giveUp = attempts >= MAX_ATTEMPTS;
      await admin.from("email_outbox").update({
        attempts, last_error: msg.slice(0, 1000),
        status: giveUp ? "failed" : "pending",
        next_attempt_at: new Date(Date.now() + delayMin * 60_000).toISOString(),
      }).eq("id", row.id);
      if (giveUp) await logOpsFailure({ source: "process-email-outbox", target: row.to_email, subject: "Centralizare concediu HR", error: msg });
    }
  }
  return new Response(JSON.stringify({ processed: rows.length, sent }));
});
