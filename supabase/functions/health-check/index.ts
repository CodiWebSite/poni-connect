import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (roleData?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checks: Record<string, { status: string; latency_ms: number; details?: string }> = {};

    // 1. Database check
    const dbStart = Date.now();
    try {
      const { data, error } = await supabase.from("app_settings").select("key").limit(1);
      checks.database = {
        status: error ? "error" : "ok",
        latency_ms: Date.now() - dbStart,
        details: error ? error.message : `Query OK`,
      };
    } catch (e) {
      checks.database = { status: "error", latency_ms: Date.now() - dbStart, details: e.message };
    }

    // 2. Auth service check
    const authStart = Date.now();
    try {
      const { data, error } = await supabase.auth.getUser(token);
      checks.auth = {
        status: error ? "error" : "ok",
        latency_ms: Date.now() - authStart,
        details: error ? error.message : "Auth service OK",
      };
    } catch (e) {
      checks.auth = { status: "error", latency_ms: Date.now() - authStart, details: e.message };
    }

    // 3. Storage check
    const storageStart = Date.now();
    try {
      const { data, error } = await supabase.storage.listBuckets();
      checks.storage = {
        status: error ? "error" : "ok",
        latency_ms: Date.now() - storageStart,
        details: error ? error.message : `${data?.length || 0} bucket-uri active`,
      };
    } catch (e) {
      checks.storage = { status: "error", latency_ms: Date.now() - storageStart, details: e.message };
    }

    // 4. Edge Functions (self-check)
    checks.edge_functions = {
      status: "ok",
      latency_ms: 0,
      details: "Edge Functions runtime OK (self-check)",
    };

    // 5. REST API endpoint check
    const realtimeStart = Date.now();
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });
      checks.rest_api = {
        status: resp.ok ? "ok" : "warning",
        latency_ms: Date.now() - realtimeStart,
        details: `REST API status ${resp.status}`,
      };
    } catch (e) {
      checks.rest_api = { status: "error", latency_ms: Date.now() - realtimeStart, details: e.message };
    }

    const allOk = Object.values(checks).every((c) => c.status === "ok");

    const result = {
      overall: allOk ? "healthy" : "degraded",
      checked_at: new Date().toISOString(),
      checks,
    };

    // Save to health_check_logs for historical chart
    await supabase.from("health_check_logs").insert({
      checked_at: result.checked_at,
      overall: result.overall,
      checks: checks,
    });

    // Cleanup logs older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("health_check_logs").delete().lt("checked_at", sevenDaysAgo);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
