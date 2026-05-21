// Shared CORS headers for MFA / trusted device functions
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "Necunoscut";
  const m = ua.match(/(Chrome|Firefox|Safari|Edg|Opera)\/[\d.]+/);
  const os = ua.match(/(Windows NT [\d.]+|Mac OS X [\d_]+|Linux|Android|iPhone OS [\d_]+)/);
  const browser = m ? m[0].split("/")[0].replace("Edg", "Edge") : "Browser";
  const platform = os ? os[0].replace("Mac OS X", "macOS").replace(/_/g, ".") : "OS necunoscut";
  return `${browser} pe ${platform}`;
}
