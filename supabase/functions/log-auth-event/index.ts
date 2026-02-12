import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseDeviceSummary(ua: string): string {
  if (!ua) return "Necunoscut";
  let browser = "Browser necunoscut";
  let os = "OS necunoscut";

  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox/")) browser = "Firefox";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} / ${os}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get auth token to identify user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: userError } = await createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const deviceSummary = parseDeviceSummary(userAgent);

    // Check for suspicious login: different IP from last 3 or completely new user agent
    const { data: recentLogs } = await supabase
      .from("auth_login_logs")
      .select("ip_address, user_agent")
      .eq("user_id", user.id)
      .eq("status", "success")
      .order("login_at", { ascending: false })
      .limit(5);

    let isSuspicious = false;
    if (recentLogs && recentLogs.length > 0) {
      const recentIPs = [...new Set(recentLogs.map((l: any) => l.ip_address))];
      const recentUAs = [...new Set(recentLogs.map((l: any) => l.user_agent))];

      if (!recentIPs.includes(ipAddress) && recentIPs.length >= 2) {
        isSuspicious = true;
      }
      if (!recentUAs.includes(userAgent)) {
        isSuspicious = true;
      }
    }

    // Insert the log
    await supabase.from("auth_login_logs").insert({
      user_id: user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_summary: deviceSummary,
      status: "success",
      is_suspicious: isSuspicious,
    });

    // If suspicious, notify all super_admins
    if (isSuspicious) {
      const { data: superAdmins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");

      // Get user profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const userName = profile?.full_name || user.email || "Utilizator necunoscut";

      if (superAdmins && superAdmins.length > 0) {
        const notifications = superAdmins.map((admin: any) => ({
          user_id: admin.user_id,
          title: "⚠️ Login suspect detectat",
          message: `${userName} s-a autentificat de pe ${deviceSummary} (IP: ${ipAddress})`,
          type: "warning",
          related_type: "auth_login",
        }));

        await supabase.from("notifications").insert(notifications);
      }
    }

    return new Response(JSON.stringify({ success: true, suspicious: isSuspicious }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
