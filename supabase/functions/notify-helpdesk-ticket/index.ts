import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { sendMailWithRetry } from "../_shared/smtp-retry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Always notified, regardless of roles. */
const ALWAYS_NOTIFY = ["condrea.codrin@icmpp.ro"];

const escapeHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ticket_id } = await req.json().catch(() => ({}));
    if (!ticket_id || typeof ticket_id !== "string") {
      return json({ error: "ticket_id lipsă" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Read the ticket server-side — the payload cannot be forged by the caller.
    const { data: ticket, error: tErr } = await admin
      .from("helpdesk_tickets")
      .select("id, name, email, subject, message, ticket_type, priority, created_at")
      .eq("id", ticket_id)
      .maybeSingle();

    if (tErr || !ticket) return json({ error: "Tichet inexistent" }, 404);

    // Recipients: fixed list + all admins / super_admins with an account email
    const recipients = new Set<string>(ALWAYS_NOTIFY);
    try {
      const { data: roles } = await admin
        .from("user_roles")
        .select("user_id")
        .in("role", ["super_admin", "admin"]);
      const adminIds = new Set((roles ?? []).map((r: any) => r.user_id));
      if (adminIds.size > 0) {
        const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        for (const u of users?.users ?? []) {
          if (u.email && adminIds.has(u.id)) recipients.add(u.email.toLowerCase());
        }
      }
    } catch (e) {
      console.error("[INTERNAL] Nu am putut rezolva adresele adminilor:", e);
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";
    const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"${smtpFrom}" <${smtpUser}>`;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return json({ error: "Serviciul de email nu este configurat" }, 500);
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const isUrgent = ticket.priority === "security_high" || ticket.ticket_type === "mfa_reset";
    const createdAt = new Date(ticket.created_at ?? Date.now()).toLocaleString("ro-RO", {
      timeZone: "Europe/Bucharest",
    });
    const deepLink = "https://intranet.icmpp.ro/admin?tab=helpdesk";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
        <h2 style="color:#1a365d; border-bottom:2px solid ${isUrgent ? "#e53e3e" : "#3182ce"}; padding-bottom:10px;">
          ${isUrgent ? "⚠️ Tichet HelpDesk URGENT" : "Tichet HelpDesk nou"} — ICMPP
        </h2>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <tr><td style="padding:6px 0; color:#4a5568; width:140px;">Solicitant</td><td><strong>${escapeHtml(ticket.name)}</strong></td></tr>
          <tr><td style="padding:6px 0; color:#4a5568;">Email</td><td><a href="mailto:${escapeHtml(ticket.email)}">${escapeHtml(ticket.email)}</a></td></tr>
          <tr><td style="padding:6px 0; color:#4a5568;">Subiect</td><td>${escapeHtml(ticket.subject)}</td></tr>
          <tr><td style="padding:6px 0; color:#4a5568;">Tip</td><td>${escapeHtml(ticket.ticket_type ?? "general")}</td></tr>
          <tr><td style="padding:6px 0; color:#4a5568;">Prioritate</td><td>${escapeHtml(ticket.priority ?? "normal")}</td></tr>
          <tr><td style="padding:6px 0; color:#4a5568;">Data</td><td>${escapeHtml(createdAt)}</td></tr>
        </table>
        <div style="background:#f7fafc; border-left:4px solid ${isUrgent ? "#e53e3e" : "#3182ce"}; padding:12px 16px; margin:16px 0; border-radius:0 6px 6px 0; white-space:pre-wrap;">${escapeHtml(ticket.message)}</div>
        <p><a href="${deepLink}" style="display:inline-block; background:#3182ce; color:#ffffff; text-decoration:none; padding:10px 18px; border-radius:6px;">Deschide tichetul în Intranet</a></p>
        <p style="color:#718096; font-size:12px; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:10px;">
          Notificare automată — Intranet ICMPP. Poți răspunde direct solicitantului din secțiunea HelpDesk IT.
        </p>
      </div>
    `;

    const to = Array.from(recipients).join(", ");
    await sendMailWithRetry(
      transporter,
      {
        from: fromAddress,
        to,
        replyTo: ticket.email,
        subject: `${isUrgent ? "[URGENT] " : ""}Tichet HelpDesk: ${ticket.subject} — ${ticket.name}`,
        html,
      },
      { label: "notify-helpdesk-ticket" },
    );

    return json({ success: true, notified: recipients.size });
  } catch (error) {
    console.error("[INTERNAL] Error in notify-helpdesk-ticket:", error);
    return json({ error: "Eroare internă la notificarea HelpDesk" }, 500);
  }
});
