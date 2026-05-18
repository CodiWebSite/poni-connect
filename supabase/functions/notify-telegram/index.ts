// DEPRECATED — Telegram notifications removed in v2 (May 2026).
// Kept as a 200 no-op so existing DB triggers / external callers do not break.
// Replacement: notify-internal-alert (in-app + email).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // Intentionally do NOT read TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
  // and do NOT perform any external fetch.
  console.log("[notify-telegram] deprecated call ignored");
  return new Response(
    JSON.stringify({ ok: true, deprecated: true, replacement: "notify-internal-alert" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
