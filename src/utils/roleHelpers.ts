/**
 * Pure helpers extracted for unit testing.
 * Keep in sync with the inline logic in LeaveApprovalPanel.tsx and AdminUsersPanel.tsx.
 */

export interface EpdLookup {
  first_name?: string | null;
  last_name?: string | null;
}

export interface ProfileLookup {
  full_name?: string | null;
}

/**
 * Resolves the employee display name for notifications/emails with multiple fallbacks.
 * 1. Use the provided name if it's valid (not empty, not "N/A").
 * 2. Fallback to employee_personal_data (last_name + first_name).
 * 3. Fallback to profiles.full_name.
 * 4. Final fallback: "Angajat".
 */
export function resolveEmployeeName(
  provided: string | null | undefined,
  epd: EpdLookup | null,
  profile: ProfileLookup | null
): string {
  if (provided && provided !== 'N/A' && provided.trim() !== '') return provided;
  if (epd?.last_name && epd?.first_name) return `${epd.last_name} ${epd.first_name}`;
  if (profile?.full_name && profile.full_name.trim() !== '') return profile.full_name;
  return 'Angajat';
}

/**
 * Detects whether a Postgres / Supabase error is a UNIQUE-constraint violation.
 */
export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  return /duplicate key|unique/i.test(error.message || '');
}

/**
 * Decides whether assigning `newRole` to a user that currently has `currentRole`
 * would be a no-op (the role is already in place).
 */
export function isRoleNoop(currentRole: string | null | undefined, newRole: string): boolean {
  return (currentRole || '').toLowerCase() === newRole.toLowerCase();
}
