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

    const body = await req.json().catch(() => ({}));
    const equipment_id = body?.equipment_id;
    const pin = body?.pin;

    if (!equipment_id || !pin || typeof pin !== "string" || pin.length > 64) {
      return json({ success: false, error: "Missing parameters" }, 400);
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const { data: settings } = await supabaseAdmin
      .from("equipment_pin_settings")
      .select("id, global_pin_hash, max_attempts, lockout_minutes")
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.global_pin_hash) {
      return json({ success: true });
    }

    const maxAttempts = settings.max_attempts ?? 5;
    const lockoutMinutes = settings.lockout_minutes ?? 15;
    const since = new Date(Date.now() - lockoutMinutes * 60_000).toISOString();

    // Protecție anti-forțare brută: numărăm încercările greșite recente pe IP
    const { count: failedCount } = await supabaseAdmin
      .from("inventory_pin_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("success", false)
      .gte("created_at", since);

    if ((failedCount ?? 0) >= maxAttempts) {
      return json(
        { success: false, error: "locked", retry_after_minutes: lockoutMinutes },
        429,
      );
    }

    const stored = String(settings.global_pin_hash);
    const isHashed = /^[a-f0-9]{64}$/.test(stored);
    const pinHash = await sha256Hex(pin);

    let isValid: boolean;
    if (isHashed) {
      isValid = pinHash === stored;
    } else {
      // PIN vechi salvat în clar — îl validăm o singură dată și îl migrăm la hash
      isValid = pin === stored;
      if (isValid) {
        await supabaseAdmin
          .from("equipment_pin_settings")
          .update({ global_pin_hash: pinHash })
          .eq("id", settings.id);
      }
    }

    await supabaseAdmin.from("inventory_pin_attempts").insert({
      ip,
      equipment_id,
      success: isValid,
    });

    return json({ success: isValid });
  } catch (_error) {
    return json({ success: false, error: "Internal error" }, 500);
  }
});
