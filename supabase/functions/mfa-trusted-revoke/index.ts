import { createClient } from "@supabase/supabase-js";
import { corsHeaders, jsonResponse, getClientIp } from "../_shared/auth-cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Neautentificat" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return jsonResponse({ error: "Sesiune invalidă" }, 401);

    const body = await req.json().catch(() => ({}));
    const all = !!body?.all;
    const deviceId: string | undefined = body?.deviceId;
    const targetUserId: string = body?.targetUserId ?? user.id;
    const reason: string = (body?.reason ?? "user_revoked").toString().slice(0, 120);

    // If revoking for another user, require super_admin
    if (targetUserId !== user.id) {
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
      if (!roleRow) return jsonResponse({ error: "Acces interzis" }, 403);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    if (all) {
      const { data: count } = await admin.rpc("revoke_all_trusted_devices", { _user_id: targetUserId, _reason: reason });
      await admin.from("security_events").insert({
        user_id: targetUserId,
        event_type: "trusted_device_revoked",
        severity: "info",
        ip_address: getClientIp(req),
        details: { all: true, count, reason, by_user: user.id },
      });
      return jsonResponse({ success: true, revoked: count ?? 0 });
    }

    if (!deviceId) return jsonResponse({ error: "deviceId obligatoriu" }, 400);
    const { error } = await admin
      .from("trusted_auth_devices")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
      .eq("id", deviceId)
      .eq("user_id", targetUserId)
      .is("revoked_at", null);
    if (error) return jsonResponse({ error: error.message }, 500);

    await admin.from("security_events").insert({
      user_id: targetUserId,
      event_type: "trusted_device_revoked",
      severity: "info",
      ip_address: getClientIp(req),
      details: { device_id: deviceId, reason, by_user: user.id },
    });

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("[INTERNAL] trusted-revoke error:", err);
    return jsonResponse({ error: "Eroare internă" }, 500);
  }
});
