/**
 * Data masking utilities for sensitive PII fields.
 */

export type MaskableField = 'cnp' | 'ci_series' | 'ci_number' | 'phone' | 'address';

/**
 * Mask a sensitive field value.
 * - CNP: shows first 2 and last 2 digits → "29xxxxxxxxx12"
 * - CI series: shows first 2 chars → "XX****"
 * - CI number: shows last 2 digits → "****78"
 * - Phone: shows last 3 digits → "****789"
 * - Address: shows city only → "Iași, ***"
 */
export function maskSensitiveField(
  value: string | null | undefined,
  type: MaskableField
): string {
  if (!value) return '—';

  switch (type) {
    case 'cnp': {
      if (value.length < 4) return '****';
      return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
    }
    case 'ci_series': {
      if (value.length <= 2) return value;
      return value.slice(0, 2) + '*'.repeat(value.length - 2);
    }
    case 'ci_number': {
      if (value.length <= 2) return '****';
      return '*'.repeat(value.length - 2) + value.slice(-2);
    }
    case 'phone': {
      if (value.length <= 3) return '****';
      return '*'.repeat(value.length - 3) + value.slice(-3);
    }
    case 'address': {
      // Just show a generic masked value
      return '***';
    }
    default:
      return '****';
  }
}

/**
 * Check if a user role should see unmasked sensitive data.
 */
export function canViewUnmasked(role: string | null): boolean {
  return ['super_admin', 'hr', 'sef_srus'].includes(role || '');
}
