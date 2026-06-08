import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_ROLES = new Set([
  "super_admin",
  "director_institut",
  "director_adjunct",
  "secretariat",
]);

function formatBucharest(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      timeZone: "Europe/Bucharest",
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow service-role calls (cron / admin) and anon-key system calls (pg_cron).
    // Otherwise require an authorized user role.
    const isServiceRole = token === serviceRoleKey;
    const isSystemAnon = token === anonKey;
      if (!isServiceRole && !isSystemAnon) {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      const hasRole = (roles || []).some((r: any) => ALLOWED_ROLES.has(r.role));
      if (!hasRole) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { meeting_id } = await req.json().catch(() => ({}));
    if (!meeting_id) {
      return new Response(JSON.stringify({ error: "meeting_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: meeting, error: mErr } = await admin
      .from("meetings")
      .select("*")
      .eq("id", meeting_id)
      .maybeSingle();

    if (mErr || !meeting) {
      return new Response(JSON.stringify({ error: "Meeting not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!meeting.reminder_enabled || meeting.status !== "scheduled") {
      return new Response(JSON.stringify({ skipped: "not_eligible" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients: string[] = Array.from(
      new Set((meeting.reminder_emails || []).filter((e: string) => !!e && e.includes("@")))
    );
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ skipped: "no_recipients" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SMTP
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || "";
    const fromAddress = smtpFrom.includes("@") ? smtpFrom : `"${smtpFrom}" <${smtpUser}>`;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("SMTP not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color:#1a365d;border-bottom:2px solid #3182ce;padding-bottom:10px;">
          📅 Reminder întâlnire — ${escapeHtml(meeting.title)}
        </h2>
        <p>Vă reamintim despre întâlnirea programată:</p>
        <table style="width:100%;border-collapse:collapse;margin:15px 0;">
          <tr style="background:#ebf8ff;">
            <td style="padding:8px 12px;border:1px solid #bee3f8;font-weight:bold;width:160px;">Titlu</td>
            <td style="padding:8px 12px;border:1px solid #bee3f8;">${escapeHtml(meeting.title)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #bee3f8;font-weight:bold;">Început</td>
            <td style="padding:8px 12px;border:1px solid #bee3f8;">${escapeHtml(formatBucharest(meeting.start_at))}</td>
          </tr>
          <tr style="background:#ebf8ff;">
            <td style="padding:8px 12px;border:1px solid #bee3f8;font-weight:bold;">Sfârșit</td>
            <td style="padding:8px 12px;border:1px solid #bee3f8;">${escapeHtml(formatBucharest(meeting.end_at))}</td>
          </tr>
          ${meeting.location ? `<tr><td style="padding:8px 12px;border:1px solid #bee3f8;font-weight:bold;">Locație</td><td style="padding:8px 12px;border:1px solid #bee3f8;">${escapeHtml(meeting.location)}</td></tr>` : ""}
          ${meeting.participants ? `<tr style="background:#ebf8ff;"><td style="padding:8px 12px;border:1px solid #bee3f8;font-weight:bold;">Participanți</td><td style="padding:8px 12px;border:1px solid #bee3f8;">${escapeHtml(meeting.participants)}</td></tr>` : ""}
          ${meeting.notes ? `<tr><td style="padding:8px 12px;border:1px solid #bee3f8;font-weight:bold;">Observații</td><td style="padding:8px 12px;border:1px solid #bee3f8;">${escapeHtml(meeting.notes)}</td></tr>` : ""}
        </table>
        <p style="color:#718096;font-size:12px;margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px;">
          Mesaj automat — Agenda întâlniri ICMPP. Nu răspundeți la acest email.
        </p>
      </div>
    `;

    let sent = 0;
    for (const to of recipients) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to,
          subject: `📅 Reminder: ${meeting.title} — ${formatBucharest(meeting.start_at)}`,
          html,
        });
        sent++;
      } catch (e) {
        console.error("Send failed for", to, e);
      }
    }

    await admin
      .from("meetings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", meeting_id);

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[INTERNAL] send-meeting-reminder error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
