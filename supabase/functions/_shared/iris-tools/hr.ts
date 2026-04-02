export async function getEmployeeSummary(supabase: any, employeeName: string) {
  // Search by name (case-insensitive partial match)
  const { data: employees } = await supabase
    .from("employee_personal_data")
    .select("id, first_name, last_name, email, department, position, employment_date, ci_expiry_date, total_leave_days, used_leave_days, employee_record_id, is_archived")
    .eq("is_archived", false)
    .or(`first_name.ilike.%${employeeName}%,last_name.ilike.%${employeeName}%`);

  if (!employees || employees.length === 0) {
    return { error: `Nu s-a găsit niciun angajat cu numele „${employeeName}".` };
  }

  // If multiple matches, return them all briefly
  if (employees.length > 5) {
    return {
      multiple: true,
      count: employees.length,
      names: employees.slice(0, 10).map((e: any) => `${e.first_name} ${e.last_name} (${e.department || "N/A"})`),
    };
  }

  const summaries = [];
  for (const emp of employees) {
    const summary: any = {
      name: `${emp.first_name} ${emp.last_name}`,
      email: emp.email,
      department: emp.department || "Nespecificat",
      position: emp.position || "Nespecificată",
      employmentDate: emp.employment_date,
      ciExpiry: emp.ci_expiry_date || "Nespecificată",
      totalLeaveDays: emp.total_leave_days ?? "N/A",
      usedLeaveDays: emp.used_leave_days ?? 0,
      remainingLeaveDays: emp.total_leave_days != null ? emp.total_leave_days - (emp.used_leave_days || 0) : "N/A",
    };

    // Check if employee has a linked user account
    const { data: authProfile } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .ilike("full_name", `%${emp.first_name}%`)
      .ilike("full_name", `%${emp.last_name}%`)
      .limit(1)
      .single();

    summary.hasAccount = !!authProfile;

    // Check user role if account exists
    if (authProfile) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authProfile.user_id)
        .single();
      summary.role = roleData?.role || "user";
    }

    // Recent leave requests
    if (authProfile) {
      const { data: recentLeaves } = await supabase
        .from("leave_requests")
        .select("start_date, end_date, working_days, status")
        .eq("user_id", authProfile.user_id)
        .order("created_at", { ascending: false })
        .limit(3);
      summary.recentLeaves = recentLeaves || [];
    }

    // Employee documents
    if (authProfile) {
      const { data: docs } = await supabase
        .from("employee_documents")
        .select("name, document_type, created_at")
        .eq("user_id", authProfile.user_id)
        .order("created_at", { ascending: false })
        .limit(5);
      summary.documents = docs || [];
    }

    summaries.push(summary);
  }

  return employees.length === 1 ? summaries[0] : { multiple: true, count: employees.length, employees: summaries };
}

export async function getExpiringDocuments(supabase: any, days: number = 90) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  const today = new Date().toISOString().split("T")[0];
  const future = futureDate.toISOString().split("T")[0];

  const { data, count } = await supabase
    .from("employee_personal_data")
    .select("first_name, last_name, department, ci_expiry_date", { count: "exact" })
    .eq("is_archived", false)
    .lt("ci_expiry_date", future)
    .gt("ci_expiry_date", today)
    .order("ci_expiry_date", { ascending: true })
    .limit(20);

  return {
    documents: (data || []).map((d: any) => ({
      name: `${d.first_name} ${d.last_name}`,
      department: d.department,
      expiryDate: d.ci_expiry_date,
    })),
    count: count || 0,
    period: `${days} zile`,
  };
}

export async function getEmployeesWithoutAccounts(supabase: any) {
  // Get all active EPD emails
  const { data: epds } = await supabase
    .from("employee_personal_data")
    .select("first_name, last_name, email, department")
    .eq("is_archived", false)
    .is("employee_record_id", null);

  return {
    employees: (epds || []).map((e: any) => ({
      name: `${e.first_name} ${e.last_name}`,
      email: e.email,
      department: e.department,
    })),
    count: (epds || []).length,
  };
}
