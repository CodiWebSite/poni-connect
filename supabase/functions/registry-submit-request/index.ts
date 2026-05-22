import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

// in-memory rate limit
const rl = new Map<string, { c: number; t: number }>();
function rateLimit(key: string, max = 10, win = 60_000) {
  const now = Date.now();
  const e = rl.get(key);
  if (!e || now - e.t > win) { rl.set(key, { c: 1, t: now }); return true; }
  if (e.c >= max) return false;
  e.c++; return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "invalid_body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { department_key, pin, payload } = body as { department_key?: string; pin?: string; payload?: Record<string, unknown> };
    if (!department_key || !pin || !payload) {
      return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!rateLimit(`${userId}:${department_key}`, 8, 60_000)) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(url, service);
    const ip = getIp(req);
    const ua = (req.headers.get("user-agent") || "").slice(0, 500);

    // 1) Verify PIN
    const { data: pinRes, error: pinErr } = await admin.rpc("_verify_registry_pin", {
      _user_id: userId, _department_key: department_key, _pin: pin,
    });
    if (pinErr) {
      console.error("[registry-submit] pin verify error");
      return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const ok = (pinRes as { ok?: boolean })?.ok === true;
    if (!ok) {
      // audit failed attempt (without PIN)
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "registry_pin_failed",
        entity_type: "registry_department_settings",
        entity_id: department_key,
        details: { ip, reason: (pinRes as { reason?: string })?.reason ?? "invalid_pin" },
      });
      return new Response(JSON.stringify({ error: "pin_invalid", details: pinRes }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Submit verified
    const verifiedPayload = { ...payload, department_key };
    const { data: requestId, error: subErr } = await admin.rpc("_submit_registry_request_verified", {
      _payload: verifiedPayload, _actor_user_id: userId, _actor_ip: ip, _actor_user_agent: ua,
    });
    if (subErr) {
      console.error("[registry-submit] submit error:", subErr.message);
      return new Response(JSON.stringify({ error: "submit_failed", detail: subErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ request_id: requestId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[registry-submit] unexpected", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
