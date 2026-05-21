import { createClient } from "@supabase/supabase-js";
import { corsHeaders, jsonResponse, sha256Hex, getClientIp } from "../_shared/auth-cors.ts";

// Generates 10 single-use recovery codes for the caller.
// REQUIRES AAL2 — the user must have already verified MFA. Replaces any existing codes (old codes are invalidated).

function generateCode(): string {
  // 8 alphanumeric chars (no ambiguous 0/O/1/I), formatted XXXX-XXXX
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

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

    const { data: aal } = await caller.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      return jsonResponse({ error: "Generarea codurilor de recuperare necesită MFA verificat" }, 403);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Delete previous codes (regeneration invalidates old ones)
    await admin.from("mfa_recovery_codes").delete().eq("user_id", user.id);

    const batchId = crypto.randomUUID();
    const codes: string[] = [];
    const rows = [];
    for (let i = 0; i < 10; i++) {
      const code = generateCode();
      codes.push(code);
      rows.push({ user_id: user.id, code_hash: await sha256Hex(code), batch_id: batchId });
    }

    const { error: insErr } = await admin.from("mfa_recovery_codes").insert(rows);
    if (insErr) {
      console.error("[INTERNAL] recovery-generate insert error:", insErr);
      return jsonResponse({ error: "Nu am putut genera codurile" }, 500);
    }

    await admin.from("security_events").insert({
      user_id: user.id,
      event_type: "mfa_recovery_codes_generated",
      severity: "info",
      ip_address: getClientIp(req),
      details: { count: codes.length, batch_id: batchId },
    });

    await admin.rpc("log_audit_event", {
      _user_id: user.id,
      _action: "mfa_recovery_codes_generated",
      _entity_type: "user",
      _entity_id: user.id,
      _details: { count: codes.length, batch_id: batchId },
    });

    return jsonResponse({ success: true, codes, batch_id: batchId, count: codes.length });
  } catch (err) {
    console.error("[INTERNAL] recovery-generate error:", err);
    return jsonResponse({ error: "Eroare internă" }, 500);
  }
});
