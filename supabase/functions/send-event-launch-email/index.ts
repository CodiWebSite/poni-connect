import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { sendMailWithRetry } from "../_shared/smtp-retry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZOOM_URL =
  "https://us06web.zoom.us/j/89474990338?pwd=vu52sa6gWEuUK2qSJQMacZjyfRT3oK.1";

const EVENT_TITLE = "Eveniment lansare proiect PIOChitIns";
const EVENT_WHEN = "vineri, 25 septembrie 2026, ora 10:15";

const buildHtml = () => `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #1a202c; line-height: 1.65;">
  <div style="text-align:center; border-bottom: 2px solid #4c1d95; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color:#4c1d95; margin:0; font-size: 22px;">Intranet ICMPP — Anunț oficial</h1>
    <p style="color:#6b7280; margin: 6px 0 0; font-size: 13px;">Institutul de Chimie Macromoleculară „Petru Poni"</p>
  </div>

  <p>Stimați colegi,</p>

  <p>Vă invităm să participați la <strong>${EVENT_TITLE}</strong>.</p>

  <table style="border-collapse: collapse; margin: 20px 0; font-family: Arial, sans-serif; font-size: 15px;">
    <tr><td style="padding: 6px 12px 6px 0; color:#6b7280;">Data și ora</td><td style="padding: 6px 0;"><strong>${EVENT_WHEN}</strong></td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color:#6b7280;">Locul</td><td style="padding: 6px 0;">Online, pe Zoom</td></tr>
  </table>

  <div style="text-align:center; margin: 32px 0;">
    <a href="${ZOOM_URL}" style="background:#4c1d95; color:#ffffff; text-decoration:none; padding: 14px 28px; border-radius: 8px; font-family: Arial, sans-serif; font-size: 15px; display:inline-block;">Intră în ședință</a>
  </div>

  <p style="font-size: 13px; color:#6b7280;">Dacă butonul nu funcționează, copiați adresa în browser:<br>
  <a href="${ZOOM_URL}" style="color:#6d28d9; word-break: break-all;">${ZOOM_URL}</a></p>

  <p style="font-size: 13px; color:#6b7280; margin-top: 24px;">Linkul este disponibil și în secțiunea <em>Anunțuri</em> din platforma internă.</p>

  <p style="margin-top: 28px;">Cu deosebită considerație,<br><strong>Echipa Intranet ICMPP</strong></p>
</div>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let testTo: string | null = null;
    let offset = 0;
    let limit = 60;
    try {
      const body = await req.json();
      if (typeof body?.test_to === "string" && body.test_to.includes("@")) testTo = body.test_to;
      if (Number.isFinite(body?.offset)) offset = Math.max(0, Math.floor(body.offset));
      if (Number.isFinite(body?.limit)) limit = Math.min(200, Math.max(1, Math.floor(body.limit)));
    } catch (_) { /* no body */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let recipients: string[] = [];
    let total = 0;
    if (testTo) {
      recipients = [testTo];
    } else {
      const { data: doctoralRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "doctorand");
      const excluded = new Set((doctoralRoles || []).map((r: { user_id: string }) => r.user_id));

      const emails: string[] = [];
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const users = data?.users || [];
        for (const u of users) {
          if (!u.email || excluded.has(u.id)) continue;
          if (u.banned_until) continue;
          emails.push(u.email.trim().toLowerCase());
        }
        if (users.length < 200) break;
      }
      const all = Array.from(new Set(emails.filter((e) => e.includes("@")))).sort();
      total = all.length;
      recipients = all.slice(offset, offset + limit);
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"Intranet ICMPP" <${smtpUser}>`;
    const subject = `${EVENT_TITLE} — ${EVENT_WHEN}`;
    const html = buildHtml();

    let sent = 0;
    const failed: string[] = [];

    for (const to of recipients) {
      try {
        await sendMailWithRetry(
          transporter,
          { from: fromAddress, to, subject, html },
          { label: "send-event-launch-email" },
        );
        sent++;
      } catch (_) {
        failed.push(to);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: testTo ? 1 : total,
        batch: recipients.length,
        offset,
        sent,
        failed: failed.length,
        next_offset: testTo ? null : (offset + recipients.length < total ? offset + recipients.length : null),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (_e) {
    console.error("send-event-launch-email failed:", JSON.stringify(_e instanceof Error ? _e.message : _e));
    return new Response(JSON.stringify({ error: "Failed to send emails" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
