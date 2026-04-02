export async function createCorrectionRequest(
  supabase: any,
  userId: string,
  fieldName: string,
  currentValue: string,
  requestedValue: string,
  reason: string
) {
  const { data, error } = await supabase
    .from("data_correction_requests")
    .insert({
      user_id: userId,
      field_name: fieldName,
      current_value: currentValue,
      requested_value: requestedValue,
      reason,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Correction request error:", error);
    return { error: "Eroare la crearea cererii de corecție: " + error.message };
  }

  // Notify HR
  const { data: hrUsers } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["hr", "sef_srus", "super_admin"]);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .single();

  for (const hr of (hrUsers || [])) {
    await supabase.from("notifications").insert({
      user_id: hr.user_id,
      title: "Cerere corecție date (IRIS)",
      message: `${profile?.full_name || "Un angajat"} solicită corecția câmpului "${fieldName}" prin IRIS.`,
      type: "warning",
      related_type: "data_correction",
      related_id: data.id,
    });
  }

  return { success: true, requestId: data.id };
}

export async function createHelpdeskTicket(
  supabase: any,
  name: string,
  email: string,
  subject: string,
  message: string
) {
  const { data, error } = await supabase
    .from("helpdesk_tickets")
    .insert({
      name,
      email,
      subject,
      message,
      status: "open",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Helpdesk ticket error:", error);
    return { error: "Eroare la crearea tichetului: " + error.message };
  }

  return { success: true, ticketId: data.id };
}

export async function createHRRequest(
  supabase: any,
  userId: string,
  requestType: string,
  details: Record<string, any>
) {
  const { data, error } = await supabase
    .from("hr_requests")
    .insert({
      user_id: userId,
      request_type: requestType,
      details,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("HR request error:", error);
    return { error: "Eroare la crearea cererii HR: " + error.message };
  }

  // Notify HR
  const { data: hrUsers } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["hr", "sef_srus", "super_admin"]);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .single();

  for (const hr of (hrUsers || [])) {
    await supabase.from("notifications").insert({
      user_id: hr.user_id,
      title: `Cerere ${requestType} nouă (IRIS)`,
      message: `${profile?.full_name || "Un angajat"} a depus o cerere de tip "${requestType}" prin IRIS.`,
      type: "info",
      related_type: "hr_request",
      related_id: data.id,
    });
  }

  return { success: true, requestId: data.id };
}
