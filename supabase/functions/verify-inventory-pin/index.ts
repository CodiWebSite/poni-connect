import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Autentificare obligatorie: doar utilizatori logați pot testa PIN-ul
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ success: false, error: "Unauthorized" }, 401);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return json({ success: false, error: "Unauthorized" }, 401);

    const { equipment_id, pin } = await req.json();
    if (!equipment_id || !pin || typeof pin !== "string" || pin.length > 64) {
      return json({ success: false, error: "Missing parameters" }, 400);
    }

    const { data: settings } = await supabaseAdmin
      .from("equipment_pin_settings")
      .select("id, global_pin_hash, max_attempts, lockout_minutes")
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.global_pin_hash) {
      return json({ success: true });
    }

    const stored = String(settings.global_pin_hash);
    const isHashed = /^[a-f0-9]{64}$/.test(stored);
    const pinHash = await sha256Hex(pin);

    let isValid: boolean;
    if (isHashed) {
      isValid = pinHash === stored;
    } else {
      // PIN vechi salvat în clar — validăm o singură dată și migrăm la hash
      isValid = pin === stored;
      if (isValid) {
        await supabaseAdmin
          .from("equipment_pin_settings")
          .update({ global_pin_hash: pinHash })
          .eq("id", settings.id);
      }
    }

    return json({ success: isValid });
  } catch (_error) {
    return json({ success: false, error: "Internal error" }, 500);
  }
});
