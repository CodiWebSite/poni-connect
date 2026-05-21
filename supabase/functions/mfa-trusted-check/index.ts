import { createClient } from "@supabase/supabase-js";
import { corsHeaders, jsonResponse, sha256Hex, getClientIp } from "../_shared/auth-cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ valid: false, reason: "unauth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return jsonResponse({ valid: false, reason: "unauth" }, 401);

    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string" || token.length < 20) {
      return jsonResponse({ valid: false, reason: "missing_token" });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const tokenHash = await sha256Hex(token);

    const { data: device, error } = await admin
      .from("trusted_auth_devices")
      .select("id, user_id, expires_at, revoked_at")
      .eq("device_token_hash", tokenHash)
      .maybeSingle();

    if (error || !device) {
      return jsonResponse({ valid: false, reason: "not_found" });
    }

    if (device.user_id !== user.id) {
      // Token does not belong to this account — security event
      await admin.from("security_events").insert({
        user_id: user.id,
        event_type: "mfa_bypass_rejected",
        severity: "warning",
        ip_address: getClientIp(req),
        details: { reason: "token_user_mismatch" },
      });
      return jsonResponse({ valid: false, reason: "mismatch" });
    }

    if (device.revoked_at) return jsonResponse({ valid: false, reason: "revoked" });
    if (new Date(device.expires_at) < new Date()) return jsonResponse({ valid: false, reason: "expired" });

    // Check user is not force-MFA-reenroll
    const { data: profile } = await admin
      .from("profiles")
      .select("force_mfa_reenroll")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.force_mfa_reenroll) return jsonResponse({ valid: false, reason: "force_reenroll" });

    // Update last_used_at + last_ip
    await admin
      .from("trusted_auth_devices")
      .update({ last_used_at: new Date().toISOString(), last_ip: getClientIp(req) })
      .eq("id", device.id);

    await admin.from("security_events").insert({
      user_id: user.id,
      event_type: "trusted_device_used",
      severity: "info",
      ip_address: getClientIp(req),
      details: { device_id: device.id },
    });

    return jsonResponse({ valid: true, device_id: device.id });
  } catch (err) {
    console.error("[INTERNAL] trusted-check error:", err);
    return jsonResponse({ valid: false, reason: "internal" }, 500);
  }
});
