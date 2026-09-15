// Sărbătorile legale din România (Codul Muncii art. 139) — calculate automat
const FIXED_HOLIDAYS = [
  "01-01","01-02","01-06","01-07","01-24",
  "05-01","06-01","08-15","11-30","12-01","12-25","12-26",
];

function orthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julian = new Date(year, month - 1, day);
  julian.setDate(julian.getDate() + 13);
  return julian;
}

const holidayCache = new Map<number, string[]>();

function holidaysForYear(year: number): string[] {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const pad = (n: number) => String(n).padStart(2, "0");
  const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const list = FIXED_HOLIDAYS.map((mmdd) => `${year}-${mmdd}`);
  const easter = orthodoxEaster(year);
  [-2, 0, 1, 49, 50].forEach((offset) => {
    const d = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate());
    d.setDate(d.getDate() + offset);
    list.push(key(d));
  });
  holidayCache.set(year, list);
  return list;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const ds = formatDate(current);
    const year = current.getFullYear();
    if (!isWeekend(current) && !(PUBLIC_HOLIDAYS[year]?.includes(ds))) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function checkLeaveBalance(supabase: any, userId: string) {
  const { data: record } = await supabase
    .from("employee_records")
    .select("total_leave_days, used_leave_days, remaining_leave_days, hire_date, contract_type")
    .eq("user_id", userId)
    .single();

  if (!record) return { error: "Nu s-au găsit date de concediu pentru acest utilizator." };

  // Check carryover
  const { data: epd } = await supabase
    .from("employee_personal_data")
    .select("id")
    .eq("employee_record_id", (await supabase.from("employee_records").select("id").eq("user_id", userId).single()).data?.id)
    .eq("is_archived", false)
    .single();

  let carryoverDays = 0;
  if (epd?.id) {
    const currentYear = new Date().getFullYear();
    const { data: carryover } = await supabase
      .from("leave_carryover")
      .select("remaining_days")
      .eq("employee_personal_data_id", epd.id)
      .eq("to_year", currentYear)
      .single();
    carryoverDays = carryover?.remaining_days || 0;
  }

  // Check bonus
  let bonusDays = 0;
  if (epd?.id) {
    const currentYear = new Date().getFullYear();
    const { data: bonuses } = await supabase
      .from("leave_bonus")
      .select("bonus_days")
      .eq("employee_personal_data_id", epd.id)
      .eq("year", currentYear);
    bonusDays = (bonuses || []).reduce((s: number, b: any) => s + (b.bonus_days || 0), 0);
  }

  const remaining = record.remaining_leave_days ?? (record.total_leave_days - record.used_leave_days);
  
  return {
    total: record.total_leave_days,
    used: record.used_leave_days,
    remaining,
    carryover: carryoverDays,
    bonus: bonusDays,
    totalAvailable: remaining + carryoverDays,
    hireDate: record.hire_date,
    contractType: record.contract_type,
    epdId: epd?.id || null,
  };
}

export async function checkLeaveOverlaps(supabase: any, userId: string, startDate: string, endDate: string) {
  const { data: overlaps } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, status")
    .eq("user_id", userId)
    .neq("status", "rejected")
    .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);

  return overlaps || [];
}

export async function findApprover(supabase: any, userId: string) {
  // 1. Direct per-employee mapping
  const { data: directApprover } = await supabase
    .from("leave_approvers")
    .select("approver_user_id, approver_email")
    .eq("employee_user_id", userId)
    .limit(1)
    .single();

  if (directApprover?.approver_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", directApprover.approver_user_id)
      .single();
    return { userId: directApprover.approver_user_id, name: profile?.full_name || "Aprobator desemnat" };
  }

  // 2. Department-level approver
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("department")
    .eq("user_id", userId)
    .single();

  if (userProfile?.department) {
    const { data: deptApprover } = await supabase
      .from("leave_department_approvers")
      .select("approver_user_id, approver_email")
      .eq("department", userProfile.department)
      .limit(1)
      .single();

    if (deptApprover?.approver_user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", deptApprover.approver_user_id)
        .single();
      return { userId: deptApprover.approver_user_id, name: profile?.full_name || "Șef departament" };
    }
  }

  return null;
}

export async function createLeaveRequest(
  supabase: any,
  serviceClient: any,
  userId: string,
  startDate: string,
  endDate: string,
  replacementName: string,
  ip: string
) {
  const balance = await checkLeaveBalance(supabase, userId);
  if (balance.error) return { error: balance.error };

  const workingDays = calculateWorkingDays(startDate, endDate);
  if (workingDays <= 0) return { error: "Perioada selectată nu conține zile lucrătoare." };
  if (workingDays > balance.totalAvailable) {
    return { error: `Sold insuficient. Aveți ${balance.totalAvailable} zile disponibile, dar cererea necesită ${workingDays} zile.` };
  }

  const overlaps = await checkLeaveOverlaps(supabase, userId, startDate, endDate);
  if (overlaps.length > 0) {
    return { error: `Există deja o cerere activă care se suprapune cu perioada ${startDate} — ${endDate}.` };
  }

  const approver = await findApprover(supabase, userId);
  
  const year = new Date(startDate).getFullYear();

  const { data: inserted, error: insertError } = await supabase
    .from("leave_requests")
    .insert({
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
      working_days: workingDays,
      replacement_name: replacementName || "—",
      year,
      status: "pending_department_head",
      approver_id: approver?.userId || null,
      epd_id: balance.epdId || null,
    })
    .select("id, request_number, status")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "Cerere duplicat — există deja o cerere pentru această perioadă." };
    }
    console.error("Leave insert error:", insertError);
    return { error: "Eroare la crearea cererii de concediu: " + insertError.message };
  }

  // Notify approver
  if (approver?.userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single();

    await supabase.from("notifications").insert({
      user_id: approver.userId,
      title: "Cerere concediu nouă (IRIS)",
      message: `${profile?.full_name || "Un angajat"} a depus o cerere de concediu prin IRIS pentru ${startDate} — ${endDate} (${workingDays} zile).`,
      type: "info",
      related_type: "leave_request",
      related_id: inserted.id,
    });
  }

  return {
    success: true,
    requestId: inserted.id,
    requestNumber: inserted.request_number,
    workingDays,
    approverName: approver?.name || "Nedesemnat",
    status: inserted.status,
  };
}

export async function getPendingApprovals(supabase: any, userId: string, userRole: string) {
  // For HR/sef_srus: show all pending
  const isHR = ["super_admin", "hr", "sef_srus"].includes(userRole);
  
  let query = supabase
    .from("leave_requests")
    .select("id, start_date, end_date, working_days, status, user_id, created_at")
    .in("status", ["pending_department_head", "pending_srus"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (!isHR) {
    // Only show requests where current user is approver
    query = query.eq("approver_id", userId);
  }

  const { data } = await query;
  if (!data || data.length === 0) return { requests: [], count: 0 };

  // Get names for each
  const userIds = [...new Set(data.map((r: any) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", userIds);

  const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name]));

  return {
    requests: data.map((r: any) => ({
      id: r.id,
      employeeName: profileMap[r.user_id] || "Necunoscut",
      startDate: r.start_date,
      endDate: r.end_date,
      workingDays: r.working_days,
      status: r.status,
      createdAt: r.created_at,
    })),
    count: data.length,
  };
}

export async function getTeamOnLeave(supabase: any, userId: string, startDate?: string, endDate?: string) {
  const today = new Date().toISOString().split("T")[0];
  const from = startDate || today;
  const to = endDate || today;

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("department")
    .eq("user_id", userId)
    .single();

  if (!userProfile?.department) return { onLeave: [], count: 0 };

  // Get team members
  const { data: teamProfiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .eq("department", userProfile.department);

  if (!teamProfiles || teamProfiles.length === 0) return { onLeave: [], count: 0 };

  const teamIds = teamProfiles.map((p: any) => p.user_id);
  const profileMap = Object.fromEntries(teamProfiles.map((p: any) => [p.user_id, p.full_name]));

  const { data: leaves } = await supabase
    .from("leave_requests")
    .select("user_id, start_date, end_date, working_days, status")
    .in("user_id", teamIds)
    .in("status", ["approved", "pending_srus", "pending_department_head"])
    .lte("start_date", to)
    .gte("end_date", from);

  return {
    onLeave: (leaves || []).map((l: any) => ({
      name: profileMap[l.user_id] || "Necunoscut",
      startDate: l.start_date,
      endDate: l.end_date,
      workingDays: l.working_days,
      status: l.status,
    })),
    count: (leaves || []).length,
  };
}
