import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Whitelisted IP ranges and addresses
const ALLOWED_IPS = ["5.2.255.60"];

function isInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  const mask = ~(2 ** (32 - parseInt(bits)) - 1) >>> 0;
  const ipNum = ipToNum(ip);
  const rangeNum = ipToNum(range);
  if (ipNum === null || rangeNum === null) return false;
  return (ipNum & mask) === (rangeNum & mask);
}

function ipToNum(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

const ALLOWED_CIDRS = ["193.138.98.0/24"];

function isAllowedIP(ip: string): boolean {
  if (!ip || ip === "unknown") return false;
  if (ALLOWED_IPS.includes(ip)) return true;
  for (const cidr of ALLOWED_CIDRS) {
    if (isInCIDR(ip, cidr)) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // If IP is allowed, return immediately
    if (isAllowedIP(ip)) {
      return new Response(
        JSON.stringify({ allowed: true, ip, message: "Acces permis" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // IP not allowed — check if user has bypass via JWT
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: bypass } = await supabase
            .from("ip_bypass_users")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (bypass) {
            return new Response(
              JSON.stringify({
                allowed: true,
                ip,
                message: "Acces permis (bypass IP)",
              }),
              {
                status: 200,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }
        }
      } catch (e) {
        console.warn("Bypass check error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        allowed: false,
        ip,
        message:
          "Accesul este restricționat. Această platformă poate fi accesată doar din rețeaua institutului.",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ allowed: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
