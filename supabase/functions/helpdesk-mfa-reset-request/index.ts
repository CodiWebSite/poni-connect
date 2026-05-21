import { createClient } from "@supabase/supabase-js";
import { corsHeaders, jsonResponse, getClientIp } from "../_shared/auth-cors.ts";

// Public endpoint: a user (possibly stuck at MFA challenge) submits an MFA reset request.
// Creates a helpdesk_tickets row with ticket_type='mfa_reset', priority='security_high'.
// Notifies super_admins via the existing trigger + (best-effort) Telegram via the
// notify-telegram function. Does NOT disable MFA — admin must approve and call reset-mfa.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = await req.json().catch(() => ({}));
    const { email, fullName, reason, description, turnstileToken } = body ?? {};

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Email invalid" }, 400);
    }
    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
      return jsonResponse({ error: "Numele este obligatoriu" }, 400);
    }
    const allowedReasons = ["lost_phone", "app_reset", "codes_not_working", "other"];
    if (!allowedReasons.includes(reason)) {
      return jsonResponse({ error: "Motiv invalid" }, 400);
    }
    const desc = (description ?? "").toString().slice(0, 1000);

    // Verify turnstile if provided
    if (turnstileToken) {
      try {
        const verifyResp = await fetch(`${supabaseUrl}/functions/v1/verify-turnstile`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
          body: JSON.stringify({ token: turnstileToken }),
        });
        const verify = await verifyResp.json();
        if (!verify?.success) {
          return jsonResponse({ error: "Verificare CAPTCHA eșuată" }, 400);
        }
      } catch (_) { /* best-effort */ }
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Try to resolve a related user_id (best-effort, by email) — doesn't disable MFA either way
    let relatedUserId: string | null = null;
    try {
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = users?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (match) relatedUserId = match.id;
    } catch (_) { /* ignore */ }

    const reasonLabels: Record<string, string> = {
      lost_phone: "Telefon pierdut",
      app_reset: "Aplicație de autentificare resetată",
      codes_not_working: "Codurile nu mai funcționează",
      other: "Alt motiv",
    };

    const message = `Solicitare resetare 2FA:
Motiv: ${reasonLabels[reason]}
${desc ? `Descriere: ${desc}` : "(fără descriere suplimentară)"}
IP: ${getClientIp(req)}`;

    const { data: ticket, error: insErr } = await admin
      .from("helpdesk_tickets")
      .insert({
        name: fullName.trim().slice(0, 120),
        email: email.toLowerCase().trim(),
        subject: "Resetare 2FA — necesită verificare",
        message,
        ticket_type: "mfa_reset",
        priority: "security_high",
        related_user_id: relatedUserId,
        metadata: { reason, ip: getClientIp(req), ua: req.headers.get("user-agent")?.slice(0, 200) ?? null },
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[INTERNAL] helpdesk mfa-reset insert error:", insErr);
      return jsonResponse({ error: "Nu am putut înregistra cererea" }, 500);
    }

    // Security event for audit
    if (relatedUserId) {
      await admin.from("security_events").insert({
        user_id: relatedUserId,
        event_type: "mfa_reset_requested_by_user",
        severity: "warning",
        ip_address: getClientIp(req),
        user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
        details: { ticket_id: ticket.id, reason },
      });
    }

    // Best-effort Telegram alert (notify-telegram already used elsewhere)
    try {
      await fetch(`${supabaseUrl}/functions/v1/notify-telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
        body: JSON.stringify({
          type: "security_alert",
          title: "🔐 Cerere resetare 2FA",
          message: `${fullName} (${email}) — ${reasonLabels[reason]}`,
          severity: "warning",
          details: { ticket_id: ticket.id, description: desc.slice(0, 200) },
        }),
      });
    } catch (_) { /* ignore */ }

    return jsonResponse({ success: true, ticket_id: ticket.id });
  } catch (err) {
    console.error("[INTERNAL] helpdesk mfa-reset error:", err);
    return jsonResponse({ error: "Eroare internă" }, 500);
  }
});
