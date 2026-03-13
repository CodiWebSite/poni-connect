export const normalizeEmployeeName = (name?: string | null): string | null => {
  if (!name) return null;

  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

interface HrOwnershipParams {
  details: unknown;
  ownerEpdId?: string | null;
  ownerFullName?: string | null;
}

export const isHrRequestOwnedByUser = ({
  details,
  ownerEpdId,
  ownerFullName,
}: HrOwnershipParams): boolean => {
  const d = (details || {}) as Record<string, unknown>;

  const targetEpdId = typeof d.epd_id === 'string' ? d.epd_id : null;
  const targetEmployeeName =
    typeof d.employee_name === 'string' ? normalizeEmployeeName(d.employee_name) : null;

  const normalizedOwnerName = normalizeEmployeeName(ownerFullName);

  if (targetEpdId && ownerEpdId) return targetEpdId === ownerEpdId;
  if (targetEpdId && !ownerEpdId) return false;

  if (targetEmployeeName && normalizedOwnerName) return targetEmployeeName === normalizedOwnerName;
  if (targetEmployeeName && !normalizedOwnerName) return false;

  if (d.manualEntry === true) return false;

  return true;
};

interface LeaveRequestOwnershipParams {
  requestEpdId?: string | null;
  ownerEpdId?: string | null;
}

export const isLeaveRequestOwnedByUser = ({
  requestEpdId,
  ownerEpdId,
}: LeaveRequestOwnershipParams): boolean => {
  if (requestEpdId && ownerEpdId) return requestEpdId === ownerEpdId;
  if (requestEpdId && !ownerEpdId) return false;

  return true;
};
