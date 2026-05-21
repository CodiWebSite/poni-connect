import { createClient } from "@supabase/supabase-js";
import { corsHeaders, jsonResponse, sha256Hex, getClientIp, summarizeUserAgent } from "../_shared/auth-cors.ts";

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

    // Require AAL2 — the user must have just verified MFA
    const { data: aal } = await caller.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      return jsonResponse({ error: "Trusted device necesită MFA verificat" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const friendlyName: string | null = (body?.friendlyName ?? null)?.toString().slice(0, 80) || null;

    // Load configured trust days
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "trusted_device_days").maybeSingle();
    let days = 30;
    if (setting?.value !== undefined && setting?.value !== null) {
      const v = typeof setting.value === "number" ? setting.value : parseInt(String(setting.value), 10);
      if (!Number.isNaN(v) && v >= 1 && v <= 90) days = v;
    }

    // Generate strong random token (32 bytes → base64url ≈ 43 chars)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const tokenB64 = btoa(String.fromCharCode(...tokenBytes))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const tokenHash = await sha256Hex(tokenB64);

    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const ip = getClientIp(req);
    const uaSummary = summarizeUserAgent(req.headers.get("user-agent"));

    const { data: inserted, error: insErr } = await admin
      .from("trusted_auth_devices")
      .insert({
        user_id: user.id,
        device_token_hash: tokenHash,
        friendly_name: friendlyName,
        user_agent_summary: uaSummary,
        created_ip: ip,
        last_ip: ip,
        last_used_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .select("id, expires_at, user_agent_summary, friendly_name")
      .single();

    if (insErr) {
      console.error("[INTERNAL] trusted-create insert error:", insErr);
      return jsonResponse({ error: "Nu am putut salva browserul de încredere" }, 500);
    }

    // Audit
    await admin.from("security_events").insert({
      user_id: user.id,
      event_type: "trusted_device_created",
      severity: "info",
      ip_address: ip,
      user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
      details: { device_id: inserted.id, expires_at: inserted.expires_at, ua: uaSummary },
    });

    return jsonResponse({ success: true, token: tokenB64, device: inserted, days });
  } catch (err) {
    console.error("[INTERNAL] trusted-create error:", err);
    return jsonResponse({ error: "Eroare internă" }, 500);
  }
});
