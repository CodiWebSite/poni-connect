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
    // Rate limiting
    const ip = getClientIP(req.headers);
    if (!checkRateLimit(`create-user:${ip}`, 5, 60_000)) {
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
    const password = typeof body.password === "string" ? body.password : null;
    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : null;

    if (!email || !password || !full_name) {
      return safeErrorResponse(400, corsHeaders, "Email, parolă și nume complet sunt obligatorii.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return safeErrorResponse(400, corsHeaders, "Adresa de email nu este validă.");
    }

    if (password.length < 8) {
      return safeErrorResponse(400, corsHeaders, "Parola trebuie să aibă cel puțin 8 caractere.");
    }

    if (full_name.length < 2 || full_name.length > 200) {
      return safeErrorResponse(400, corsHeaders, "Numele trebuie să aibă între 2 și 200 de caractere.");
    }

    const adminClient = getServiceClient();

    // Create user with email confirmed
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (error) {
      console.error("[create-user] Admin API error:", error.message);
      return safeErrorResponse(400, corsHeaders, "Nu s-a putut crea contul. Verifică dacă email-ul nu este deja folosit.");
    }

    // Log audit event
    await adminClient.rpc("log_audit_event", {
      _user_id: auth.userId,
      _action: "manual_account_create",
      _entity_type: "user",
      _entity_id: data.user.id,
      _details: { email, full_name, created_by_ip: ip },
    });

    return new Response(
      JSON.stringify({ success: true, user_id: data.user.id, email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return logAndRespond(err, corsHeaders, "create-user");
  }
});
