import { createClient } from "@supabase/supabase-js";
import { corsHeaders, jsonResponse, sha256Hex, getClientIp } from "../_shared/auth-cors.ts";

// Consumes a single-use MFA recovery code. Caller must be authenticated (AAL1 is enough —
// they just signed in with password and are stuck at MFA challenge).
// On success:
//   - marks the code as used
//   - DELETES all verified TOTP factors for the user (forces re-enrollment)
//   - revokes ALL trusted devices for the user
//   - sets profiles.force_mfa_reenroll = true
//   - audits
//
// The client must then sign-out / refresh session and redirect to forced MFA setup page.

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

    const { code } = await req.json().catch(() => ({}));
    if (!code || typeof code !== "string" || code.length < 8 || code.length > 12) {
      return jsonResponse({ error: "Cod invalid" }, 400);
    }
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!/^[A-Z2-9]{4}-?[A-Z2-9]{4}$/.test(normalized)) {
      return jsonResponse({ error: "Format cod invalid" }, 400);
    }
    const codeHash = await sha256Hex(normalized.includes("-") ? normalized : `${normalized.slice(0, 4)}-${normalized.slice(4)}`);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Find matching, unused code for THIS user (defense-in-depth on user match)
    const { data: codeRow } = await admin
      .from("mfa_recovery_codes")
      .select("id, user_id, used_at")
      .eq("code_hash", codeHash)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!codeRow || codeRow.used_at) {
      await admin.from("security_events").insert({
        user_id: user.id,
        event_type: "mfa_recovery_code_invalid",
        severity: "warning",
        ip_address: getClientIp(req),
        details: { reason: codeRow ? "already_used" : "not_found" },
      });
      return jsonResponse({ error: "Cod invalid sau deja folosit" }, 400);
    }

    // Mark used
    await admin
      .from("mfa_recovery_codes")
      .update({ used_at: new Date().toISOString(), used_ip: getClientIp(req) })
      .eq("id", codeRow.id);

    // Delete all verified TOTP factors
    const { data: factorsRes } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
    const verified = (factorsRes?.factors ?? []).filter((f: any) => f.status === "verified");
    for (const f of verified) {
      await admin.auth.admin.mfa.deleteFactor({ userId: user.id, factorId: f.id });
    }

    // Revoke all trusted devices
    await admin.rpc("revoke_all_trusted_devices", {
      _user_id: user.id,
      _reason: "mfa_recovery_code_used",
    });

    // Invalidate any remaining unused recovery codes (single-batch recovery model: one use → full reset)
    await admin
      .from("mfa_recovery_codes")
      .delete()
      .eq("user_id", user.id)
      .is("used_at", null);

    // Set force re-enroll flag
    await admin
      .from("profiles")
      .update({
        force_mfa_reenroll: true,
        force_mfa_reason: "recovery_code_used",
        force_mfa_set_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    // Audit
    await admin.from("security_events").insert({
      user_id: user.id,
      event_type: "mfa_recovery_code_used",
      severity: "critical",
      ip_address: getClientIp(req),
      user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
      details: {
        message: "Cod de recuperare MFA folosit cu succes — MFA resetat, re-enrollment obligatoriu",
        factors_removed: verified.length,
      },
    });
    await admin.rpc("log_audit_event", {
      _user_id: user.id,
      _action: "mfa_recovery_code_used",
      _entity_type: "user",
      _entity_id: user.id,
      _details: { factors_removed: verified.length },
    });

    return jsonResponse({
      success: true,
      message: "Cod acceptat. Trebuie să configurezi din nou autentificarea în doi pași.",
      force_reenroll: true,
    });
  } catch (err) {
    console.error("[INTERNAL] recovery-consume error:", err);
    return jsonResponse({ error: "Eroare internă" }, 500);
  }
});
