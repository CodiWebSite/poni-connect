export function isOwnLeaveApproval(
  employeeUserId: string | null | undefined,
  recipientUserId: string | null | undefined,
): boolean {
  return Boolean(employeeUserId && recipientUserId && employeeUserId === recipientUserId);
}

export function isOwnLeaveEmail(
  employeeEmail: string | null | undefined,
  recipientEmail: string | null | undefined,
): boolean {
  if (!employeeEmail || !recipientEmail) return false;
  return employeeEmail.trim().toLowerCase() === recipientEmail.trim().toLowerCase();
}
