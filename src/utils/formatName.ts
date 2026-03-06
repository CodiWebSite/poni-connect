/**
 * Formats a name in "NUME PRENUME" (LAST_NAME FIRST_NAME) convention, all uppercase.
 * 
 * Preferred: pass last_name and first_name separately.
 * Fallback: if only full_name is available (stored as "FirstName LastName"),
 * it reverses the parts.
 */
export function formatNumePrenume(
  opts: { firstName?: string | null; lastName?: string | null; fullName?: string | null }
): string {
  const { firstName, lastName, fullName } = opts;

  if (lastName && firstName) {
    return `${lastName.toUpperCase()} ${firstName.toUpperCase()}`;
  }

  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      // Assume stored as "FirstName LastName" → reverse to "LASTNAME FIRSTNAME"
      const last = parts.slice(-1);
      const first = parts.slice(0, -1);
      return [...last, ...first].join(' ').toUpperCase();
    }
    return fullName.toUpperCase();
  }

  return 'N/A';
}
