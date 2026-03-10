import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleData?.role !== "super_admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get retention days from settings
    const { data: settingData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "audit_retention_days")
      .maybeSingle();

    const retentionDays = settingData?.value ? Number(settingData.value) : 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete old audit logs
    const { data: deleted, error: deleteError } = await supabase
      .from("audit_logs")
      .delete()
      .lt("created_at", cutoffDate.toISOString())
      .select("id");

    if (deleteError) {
      throw deleteError;
    }

    const deletedCount = deleted?.length || 0;

    // Log the cleanup action
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        await supabase.rpc("log_audit_event", {
          _user_id: user.id,
          _action: "audit_cleanup",
          _entity_type: "audit_logs",
          _details: { deleted_count: deletedCount, retention_days: retentionDays },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, deleted_count: deletedCount, retention_days: retentionDays }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
