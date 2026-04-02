export async function getSystemSummary(supabase: any) {
  const summary: Record<string, any> = {};

  // Health check
  const { data: health } = await supabase
    .from("health_check_logs")
    .select("overall, checked_at, checks")
    .order("checked_at", { ascending: false })
    .limit(1)
    .single();
  summary.health = health;

  // Pending leave requests
  const { count: pendingLeave } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending_department_head", "pending_srus"]);
  summary.pendingLeaveRequests = pendingLeave || 0;

  // Pending HR requests
  const { count: pendingHR } = await supabase
    .from("hr_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  summary.pendingHRRequests = pendingHR || 0;

  // Open helpdesk tickets
  const { count: openTickets } = await supabase
    .from("helpdesk_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  summary.openHelpdeskTickets = openTickets || 0;

  // Users without roles (only 'user' role)
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("user_id", { count: "exact", head: true });
  summary.totalUsers = totalUsers || 0;

  // Active employees
  const { count: activeEmployees } = await supabase
    .from("employee_personal_data")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", false);
  summary.activeEmployees = activeEmployees || 0;

  // Employees without accounts (no employee_record_id)
  const { count: noAccount } = await supabase
    .from("employee_personal_data")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", false)
    .is("employee_record_id", null);
  summary.employeesWithoutAccounts = noAccount || 0;

  // Expiring CI in 30 days
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const { count: expiringCI } = await supabase
    .from("employee_personal_data")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", false)
    .lt("ci_expiry_date", in30.toISOString().split("T")[0])
    .gt("ci_expiry_date", new Date().toISOString().split("T")[0]);
  summary.expiringCI30Days = expiringCI || 0;

  // Recent audit events (last 24h)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const { count: recentAudit } = await supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", yesterday.toISOString());
  summary.auditEventsLast24h = recentAudit || 0;

  // Pending account requests
  const { count: pendingAccounts } = await supabase
    .from("account_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  summary.pendingAccountRequests = pendingAccounts || 0;

  return summary;
}
