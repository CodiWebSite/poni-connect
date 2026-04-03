import { createClient } from "@supabase/supabase-js";

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

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Parse request body for event_type
    let eventType = "login";
    let eventDetails: Record<string, any> = {};
    try {
      const body = await req.json();
      if (body?.event_type) eventType = body.event_type;
      if (body?.details) eventDetails = body.details;
    } catch {
      // No body = standard login event
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const deviceSummary = parseDeviceSummary(userAgent);

    // Get user profile name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle();

    const userName = profile?.full_name || "Utilizator necunoscut";

    // Handle login events
    if (eventType === "login") {
      // Check for suspicious login
      const { data: recentLogs } = await supabase
        .from("auth_login_logs")
        .select("ip_address, user_agent")
        .eq("user_id", userId)
        .eq("status", "success")
        .order("login_at", { ascending: false })
        .limit(5);

      let isSuspicious = false;
      let isNewDevice = false;
      let isNewIP = false;

      if (recentLogs && recentLogs.length > 0) {
        const recentIPs = [...new Set(recentLogs.map((l: any) => l.ip_address))];
        const recentUAs = [...new Set(recentLogs.map((l: any) => l.user_agent))];

        if (!recentIPs.includes(ipAddress) && recentIPs.length >= 2) {
          isSuspicious = true;
          isNewIP = true;
        }
        if (!recentUAs.includes(userAgent)) {
          isNewDevice = true;
          if (recentLogs.length >= 3) isSuspicious = true;
        }
      }

      // Insert login log
      await supabase.from("auth_login_logs").insert({
        user_id: userId,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_summary: deviceSummary,
        status: "success",
        is_suspicious: isSuspicious,
      });

      // Create security events
      const securityEvents: any[] = [];

      if (isNewDevice) {
        securityEvents.push({
          user_id: userId,
          event_type: "new_device",
          severity: "warning",
          ip_address: ipAddress,
          user_agent: userAgent,
          details: { device: deviceSummary, message: `Autentificare de pe un dispozitiv nou: ${deviceSummary}` },
        });
      }

      if (isNewIP) {
        securityEvents.push({
          user_id: userId,
          event_type: "new_ip",
          severity: "warning",
          ip_address: ipAddress,
          user_agent: userAgent,
          details: { message: `Autentificare de la o adresă IP nouă: ${ipAddress}` },
        });
      }

      if (isSuspicious) {
        securityEvents.push({
          user_id: userId,
          event_type: "suspicious_login",
          severity: "critical",
          ip_address: ipAddress,
          user_agent: userAgent,
          details: { device: deviceSummary, message: `Login suspect detectat de pe ${deviceSummary} (IP: ${ipAddress})` },
        });
      }

      // Always log a successful login event
      securityEvents.push({
        user_id: userId,
        event_type: "login_success",
        severity: "info",
        ip_address: ipAddress,
        user_agent: userAgent,
        details: { device: deviceSummary },
      });

      if (securityEvents.length > 0) {
        await supabase.from("security_events").insert(securityEvents);
      }

      // Notify user about suspicious login
      if (isSuspicious) {
        // Notify the user themselves
        await supabase.from("notifications").insert({
          user_id: userId,
          title: "⚠️ Login suspect pe contul tău",
          message: `S-a detectat o autentificare neobișnuită de pe ${deviceSummary} (IP: ${ipAddress}). Dacă nu ai fost tu, schimbă-ți parola imediat.`,
          type: "warning",
          related_type: "security_event",
        });

        // Notify all super_admins
        const { data: superAdmins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin");

        if (superAdmins && superAdmins.length > 0) {
          const notifications = superAdmins
            .filter((admin: any) => admin.user_id !== userId)
            .map((admin: any) => ({
              user_id: admin.user_id,
              title: "⚠️ Login suspect detectat",
              message: `${userName} s-a autentificat de pe ${deviceSummary} (IP: ${ipAddress})`,
              type: "warning",
              related_type: "security_event",
            }));

          if (notifications.length > 0) {
            await supabase.from("notifications").insert(notifications);
          }
        }
      }

      return new Response(JSON.stringify({ success: true, suspicious: isSuspicious }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle other security events (password_change, role_change, etc.)
    if (["password_change", "role_change", "critical_action", "logout_all"].includes(eventType)) {
      const severityMap: Record<string, string> = {
        password_change: "warning",
        role_change: "critical",
        critical_action: "critical",
        logout_all: "warning",
      };

      await supabase.from("security_events").insert({
        user_id: userId,
        event_type: eventType,
        severity: severityMap[eventType] || "info",
        ip_address: ipAddress,
        user_agent: userAgent,
        details: { ...eventDetails, device: deviceSummary },
      });

      // For critical events, notify super_admins
      if (severityMap[eventType] === "critical") {
        const { data: superAdmins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin");

        const messageMap: Record<string, string> = {
          role_change: `Rolul utilizatorului ${userName} a fost modificat`,
          critical_action: `${userName} a efectuat o acțiune critică: ${eventDetails?.action || "necunoscut"}`,
        };

        if (superAdmins && superAdmins.length > 0) {
          const notifications = superAdmins
            .filter((admin: any) => admin.user_id !== userId)
            .map((admin: any) => ({
              user_id: admin.user_id,
              title: "🔐 Alertă de securitate",
              message: messageMap[eventType] || `Eveniment de securitate: ${eventType}`,
              type: "warning",
              related_type: "security_event",
            }));

          if (notifications.length > 0) {
            await supabase.from("notifications").insert(notifications);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
