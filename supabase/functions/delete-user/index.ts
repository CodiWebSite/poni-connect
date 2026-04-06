import { createClient } from "@supabase/supabase-js";
import { requireRole, getClientIP, getServiceClient } from "../_shared/auth-helpers.ts";
import { safeErrorResponse, logAndRespond } from "../_shared/error-handler.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ip = getClientIP(req.headers);
    if (!checkRateLimit(`delete-user:${ip}`, 5, 60_000)) {
      return safeErrorResponse(429, corsHeaders);
    }

    // Require super_admin role
    const auth = await requireRole(req, "super_admin");
    if (auth.error) return auth.error;

    // Input validation
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return safeErrorResponse(400, corsHeaders, "Cerere invalidă.");
    }

    const userId = typeof body.userId === "string" ? body.userId.trim() : null;
    if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) {
      return safeErrorResponse(400, corsHeaders, "ID utilizator invalid.");
    }

    // Prevent self-deletion
    if (userId === auth.userId) {
      return safeErrorResponse(400, corsHeaders, "Nu îți poți șterge propriul cont.");
    }

    const supabaseAuth = getServiceClient();

    // Clean up related data before deleting auth user
    await supabaseAuth.from("notifications").delete().eq("user_id", userId);
    await supabaseAuth.from("hr_requests").delete().eq("user_id", userId);
    await supabaseAuth.from("employee_documents").delete().eq("user_id", userId);

    const { data: empRecord } = await supabaseAuth
      .from("employee_records")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (empRecord) {
      await supabaseAuth
        .from("employee_personal_data")
        .update({ employee_record_id: null })
        .eq("employee_record_id", empRecord.id);
    }

    await supabaseAuth.from("employee_records").delete().eq("user_id", userId);
    await supabaseAuth.from("procurement_requests").delete().eq("user_id", userId);
    await supabaseAuth.from("suggestions").delete().eq("user_id", userId);
    await supabaseAuth.from("department_heads").delete().eq("head_user_id", userId);
    await supabaseAuth.from("user_roles").delete().eq("user_id", userId);
    await supabaseAuth.from("profiles").delete().eq("user_id", userId);

    const { error: deleteError } = await supabaseAuth.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("[delete-user] Admin API error:", deleteError.message);
      return safeErrorResponse(500, corsHeaders, "Eroare la ștergerea contului.");
    }

    // Log audit event
    await supabaseAuth.rpc("log_audit_event", {
      _user_id: auth.userId,
      _action: "user_deleted",
      _entity_type: "user",
      _entity_id: userId,
      _details: { deleted_by_ip: ip },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Contul a fost șters cu succes" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return logAndRespond(error, corsHeaders, "delete-user");
  }
});
