/**
 * Shared CORS configuration for edge functions.
 * Restricts origins to known platforms only.
 */

const ALLOWED_ORIGINS = [
  "https://intranet.icmpp.ro",
  "https://www.intranet.icmpp.ro",
];

const LOVABLE_PATTERN = /\.(lovable\.app|lovableproject\.com)$/;

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";

  let allowOrigin = ALLOWED_ORIGINS[0]; // default fallback

  if (ALLOWED_ORIGINS.includes(origin)) {
    allowOrigin = origin;
  } else if (LOVABLE_PATTERN.test(new URL(origin || "https://x").hostname)) {
    allowOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
