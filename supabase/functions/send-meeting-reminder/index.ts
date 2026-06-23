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

    // Decode JWT role claim (no signature check — the Supabase edge runtime
    // already validates the JWT signature before our handler runs).
    let jwtRole: string | null = null;
    try {
      const part = token.split(".")[1] || "";
      const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 ? b64 + "=".repeat(4 - (b64.length % 4)) : b64;
      const payload = JSON.parse(atob(pad));
      jwtRole = payload?.role ?? null;
    } catch (e) {
      console.error("[INTERNAL] JWT decode failed:", e);
      jwtRole = null;
    }
    console.log("[INTERNAL] auth check — jwtRole:", jwtRole);

    const isServiceRole = token === serviceRoleKey || jwtRole === "service_role";
    const isSystemAnon = token === anonKey || jwtRole === "anon";

    if (!isServiceRole && !isSystemAnon) {
      const supabaseAuth = createClient(supabaseUrl, anonKey, {
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
    const perRecipientErrors: { to: string; error: string }[] = [];
    let transporterVerifyError: string | null = null;

    try {
      await transporter.verify();
    } catch (e) {
      transporterVerifyError = (e as Error)?.message || String(e);
      console.error("[INTERNAL] SMTP verify failed:", transporterVerifyError);
    }

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
        const msg = (e as Error)?.message || String(e);
        console.error("Send failed for", to, msg);
        perRecipientErrors.push({ to, error: msg });
      }
    }

    const allFailed = sent === 0;
    const partialFailure = !allFailed && perRecipientErrors.length > 0;
    const success = !allFailed && !transporterVerifyError;
    const statusCode = success ? 200 : (allFailed ? 502 : 207);
    const errorMessage = transporterVerifyError
      ? `SMTP indisponibil: ${transporterVerifyError}`
      : (allFailed
          ? `Trimitere eșuată pentru toți destinatarii (${recipients.length}). Primul motiv: ${perRecipientErrors[0]?.error || "necunoscut"}`
          : (partialFailure
              ? `Trimitere parțială: ${sent}/${recipients.length}. Eșuat: ${perRecipientErrors.map(e => `${e.to} (${e.error})`).join("; ")}`
              : null));

    const { data: logRow } = await admin
      .from("meeting_reminder_logs")
      .insert({
        meeting_id,
        success,
        recipients_total: recipients.length,
        recipients_sent: sent,
        status_code: statusCode,
        error_message: errorMessage,
        details: {
          per_recipient_errors: perRecipientErrors,
          smtp_host: smtpHost,
          meeting_title: meeting.title,
          meeting_start_at: meeting.start_at,
        },
      })
      .select("id")
      .maybeSingle();

    if (success || partialFailure) {
      await admin
        .from("meetings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", meeting_id);
    }

    if (!success) {
      try {
        const { data: notifTargets } = await admin
          .from("user_roles")
          .select("user_id")
          .in("role", ["super_admin", "secretariat", "director_institut", "director_adjunct"]);

        const uniqueUserIds = Array.from(
          new Set(((notifTargets || []) as { user_id: string }[]).map((r) => r.user_id))
        );

        if (uniqueUserIds.length > 0) {
          const title = allFailed
            ? "Reminder întâlnire — EȘUAT"
            : "Reminder întâlnire — trimitere parțială";
          const message = `Întâlnire: ${meeting.title} (${formatBucharest(meeting.start_at)}). ${errorMessage || "Eroare necunoscută"}. Trimise: ${sent}/${recipients.length}.`;

          const rows = uniqueUserIds.map((uid) => ({
            user_id: uid,
            title,
            message,
            type: allFailed ? "error" : "warning",
            related_type: "meeting_reminder_log",
            related_id: (logRow as any)?.id ?? meeting_id,
          }));

          await admin.from("notifications").insert(rows);
        }
      } catch (notifErr) {
        console.error("[INTERNAL] failed to enqueue failure notifications:", notifErr);
      }
    }

    return new Response(
      JSON.stringify({
        success,
        sent,
        recipients_total: recipients.length,
        status_code: statusCode,
        error_message: errorMessage,
        per_recipient_errors: perRecipientErrors,
      }),
      {
        status: success ? 200 : statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[INTERNAL] send-meeting-reminder error:", err);
    const msg = (err as Error)?.message || String(err);
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const body = await req.clone().json().catch(() => ({} as any));
      if (body?.meeting_id) {
        await admin.from("meeting_reminder_logs").insert({
          meeting_id: body.meeting_id,
          success: false,
          recipients_total: 0,
          recipients_sent: 0,
          status_code: 500,
          error_message: `Internal error: ${msg}`,
          details: {},
        });
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: "Internal error", message: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
