import { createClient } from "@supabase/supabase-js";
import { requireRole, getClientIP, getServiceClient } from "../_shared/auth-helpers.ts";
import { safeErrorResponse, logAndRespond } from "../_shared/error-handler.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = getClientIP(req.headers);
    if (!checkRateLimit(`invite-user:${ip}`, 10, 60_000)) {
      return safeErrorResponse(429, corsHeaders);
    }

    // Require super_admin role
    const auth = await requireRole(req, "super_admin");
    if (auth.error) return auth.error;

    // Input validation
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return safeErrorResponse(400, corsHeaders, "Cerere invalidă.");
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return safeErrorResponse(400, corsHeaders, "Adresa de email nu este validă.");
    }

    const adminClient = getServiceClient();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${supabaseUrl}/auth/v1/callback`,
    });

    if (error) {
      console.error("[invite-user] Admin API error:", error.message);
      return safeErrorResponse(400, corsHeaders, "Nu s-a putut trimite invitația. Verifică dacă email-ul nu este deja înregistrat.");
    }

    // Log audit event
    await adminClient.rpc("log_audit_event", {
      _user_id: auth.userId,
      _action: "user_invite",
      _entity_type: "user",
      _entity_id: data.user?.id || email,
      _details: { invited_email: email, invited_by_ip: ip },
    });

    return new Response(
      JSON.stringify({ success: true, user_id: data.user?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return logAndRespond(err, corsHeaders, "invite-user");
  }
});
