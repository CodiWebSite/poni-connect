import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TABLES_TO_BACKUP = [
  "profiles",
  "user_roles",
  "employee_personal_data",
  "employee_records",
  "employee_documents",
  "leave_requests",
  "leave_approvers",
  "leave_department_approvers",
  "leave_bonus",
  "leave_carryover",
  "leave_approval_delegates",
  "hr_requests",
  "procurement_requests",
  "announcements",
  "events",
  "documents",
  "notifications",
  "audit_logs",
  "app_settings",
  "suggestions",
  "custom_holidays",
  "library_books",
  "library_magazines",
  "library_borrow_history",
  "equipment_items",
  "equipment_history",
  "backup_logs",
  "system_incidents",
  "data_correction_requests",
  "account_requests",
  "pre_assigned_roles",
  "user_onboarding",
  "auth_login_logs",
  "maintenance_subscribers",
];

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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
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

    // Export all tables
    const backup: Record<string, unknown[]> = {};
    const errors: string[] = [];
    let totalRows = 0;

    for (const table of TABLES_TO_BACKUP) {
      const { data, error } = await supabase.from(table).select("*").limit(50000);
      if (error) {
        errors.push(`${table}: ${error.message}`);
        backup[table] = [];
      } else {
        backup[table] = data || [];
        totalRows += (data || []).length;
      }
    }

    const backupPayload = {
      metadata: {
        created_at: new Date().toISOString(),
        created_by: user.id,
        tables_count: TABLES_TO_BACKUP.length,
        total_rows: totalRows,
        errors: errors.length > 0 ? errors : undefined,
      },
      data: backup,
    };

    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const sizeBytes = new TextEncoder().encode(jsonStr).length;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

    // Log this backup
    await supabase.from("backup_logs").insert({
      type: "backup",
      status: errors.length > 0 ? "partial" : "success",
      size_info: `${sizeMB} MB, ${totalRows} rânduri`,
      notes: `Backup automat — ${TABLES_TO_BACKUP.length} tabele exportate${errors.length > 0 ? `. Erori: ${errors.join("; ")}` : ""}`,
      performed_by: user.id,
    });

    // Log audit event
    await supabase.rpc("log_audit_event", {
      _user_id: user.id,
      _action: "data_backup",
      _entity_type: "system",
      _details: { tables: TABLES_TO_BACKUP.length, rows: totalRows, size_mb: sizeMB },
    });

    return new Response(jsonStr, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
