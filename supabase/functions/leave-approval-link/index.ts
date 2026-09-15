import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const action = ["info", "approve", "reject"].includes(body.action) ? body.action : "info";
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

    if (!token || token.length < 20) return json({ error: "Link invalid" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: link } = await admin
      .from("approval_links")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!link) return json({ error: "Link invalid sau expirat" }, 404);
    if (link.used_at) {
      return json({ state: "used", action: link.used_action, used_at: link.used_at });
    }
    if (new Date(link.expires_at) < new Date()) return json({ state: "expired" });

    const { data: request } = await admin
      .from("leave_requests")
      .select("id, request_number, start_date, end_date, working_days, status, employee_name, department, user_id, leave_type")
      .eq("id", link.request_id)
      .maybeSingle();

    if (!request) return json({ error: "Cererea nu a fost găsită" }, 404);

    const summary = {
      request_number: request.request_number,
      employee_name: request.employee_name,
      department: request.department,
      start_date: request.start_date,
      end_date: request.end_date,
      working_days: request.working_days,
      status: request.status,
    };

    if (action === "info") return json({ state: "ok", request: summary });

    if (request.status !== "pending_department_head") {
      return json({ state: "already_processed", request: summary });
    }

    const now = new Date().toISOString();
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

    if (action === "approve") {
      const { error } = await admin
        .from("leave_requests")
        .update({
          status: "pending_srus",
          dept_head_id: link.approver_user_id,
          dept_head_approved_at: now,
          dept_head_signature: "digital",
          dept_head_ip: ip,
        })
        .eq("id", request.id)
        .eq("status", "pending_department_head");
      if (error) return json({ error: "Aprobarea nu a putut fi salvată" }, 500);

      await admin.from("notifications").insert({
        user_id: request.user_id,
        title: "Cerere concediu aprobată de șef compartiment",
        message: `Cererea ${request.request_number} a fost aprobată de șeful de compartiment și urmează validarea SRUS.`,
        type: "info",
        related_type: "leave_request",
        related_id: request.id,
      });

      const { data: hrRoles } = await admin
        .from("user_roles")
        .select("user_id")
        .in("role", ["hr", "sef_srus", "super_admin"]);
      if (hrRoles?.length) {
        await admin.from("notifications").insert(
          hrRoles.map((r: any) => ({
            user_id: r.user_id,
            title: "Cerere concediu — necesită validare SRUS",
            message: `${request.employee_name || "Angajat"} — cererea ${request.request_number} a fost aprobată de șeful de compartiment.`,
            type: "info",
            related_type: "leave_request",
            related_id: request.id,
          }))
        );
      }
    } else {
      const { error } = await admin
        .from("leave_requests")
        .update({
          status: "rejected",
          rejection_reason: reason || "Respins de șeful de compartiment",
          dept_head_id: link.approver_user_id,
          dept_head_approved_at: now,
          dept_head_ip: ip,
        })
        .eq("id", request.id)
        .eq("status", "pending_department_head");
      if (error) return json({ error: "Respingerea nu a putut fi salvată" }, 500);

      await admin.from("notifications").insert({
        user_id: request.user_id,
        title: "Cerere concediu respinsă",
        message: `Cererea ${request.request_number} a fost respinsă. Motiv: ${reason || "nespecificat"}`,
        type: "warning",
        related_type: "leave_request",
        related_id: request.id,
      });
    }

    await admin
      .from("approval_links")
      .update({ used_at: now, used_action: action, used_ip: ip })
      .eq("id", link.id);

    await admin.from("audit_logs").insert({
      user_id: link.approver_user_id,
      action: action === "approve" ? "leave_approved_via_link" : "leave_rejected_via_link",
      entity_type: "leave_request",
      entity_id: request.id,
      details: { request_number: request.request_number, ip, initiated_via: "email_link" },
    });

    return json({ state: "done", action, request: { ...summary, status: action === "approve" ? "pending_srus" : "rejected" } });
  } catch (e) {
    console.error("leave-approval-link error", e);
    return json({ error: "Eroare internă" }, 500);
  }
});

