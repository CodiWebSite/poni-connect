export const BLOCKING_REPLACEMENT_LEAVE_STATUSES = [
  'pending_director',
  'pending_department_head',
  'pending_srus',
  'approved',
] as const;

export interface ReplacementConflict {
  start_date: string;
  end_date: string;
  status: string;
  request_number?: string;
}

export const periodsOverlap = (
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) => firstStart <= secondEnd && firstEnd >= secondStart;

export function hasBlockingReplacementConflict(
  requests: Array<Pick<ReplacementConflict, 'start_date' | 'end_date' | 'status'>>,
  startDate: string,
  endDate: string,
): boolean {
  return requests.some((request) =>
    BLOCKING_REPLACEMENT_LEAVE_STATUSES.includes(request.status as typeof BLOCKING_REPLACEMENT_LEAVE_STATUSES[number])
    && periodsOverlap(request.start_date, request.end_date, startDate, endDate));
}

export function formatReplacementConflict(conflict: ReplacementConflict): string {
  const formatDate = (value: string) => value.split('-').reverse().join('.');
  const status = conflict.status === 'approved' ? 'aprobat' : 'în așteptare';
  return `Concediu ${status}: ${formatDate(conflict.start_date)} – ${formatDate(conflict.end_date)}`;
}

export function canTransferDelegation(
  delegation: {
    delegate_user_id: string;
    is_active: boolean;
    end_date: string;
  },
  actorUserId: string | null | undefined,
  today: string,
): boolean {
  return Boolean(
    actorUserId
    && delegation.delegate_user_id === actorUserId
    && delegation.is_active
    && delegation.end_date >= today
  );
}
