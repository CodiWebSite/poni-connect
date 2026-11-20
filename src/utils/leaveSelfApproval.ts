export function canActOnLeaveRequest(
  employeeUserId: string | null | undefined,
  actorUserId: string | null | undefined,
): boolean {
  return Boolean(employeeUserId && actorUserId && employeeUserId !== actorUserId);
}

export function withoutOwnLeaveRequests<T extends { user_id?: string | null }>(
  requests: T[],
  actorUserId: string | null | undefined,
): T[] {
  if (!actorUserId) return [];
  return requests.filter((request) => canActOnLeaveRequest(request.user_id, actorUserId));
}
