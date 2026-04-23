import { describe, it, expect } from 'vitest';
import { resolveEmployeeName, isUniqueViolation, isRoleNoop } from '@/utils/roleHelpers';

describe('resolveEmployeeName (notification fallback)', () => {
  it('uses the provided name when it is valid', () => {
    expect(resolveEmployeeName('CONDREA DANIEL', null, null)).toBe('CONDREA DANIEL');
  });

  it('falls back to EPD when provided is "N/A"', () => {
    expect(
      resolveEmployeeName('N/A', { last_name: 'CONDREA', first_name: 'DANIEL' }, null)
    ).toBe('CONDREA DANIEL');
  });

  it('falls back to EPD when provided is empty', () => {
    expect(
      resolveEmployeeName('', { last_name: 'POPESCU', first_name: 'ANA' }, null)
    ).toBe('POPESCU ANA');
  });

  it('falls back to profile.full_name when EPD missing', () => {
    expect(
      resolveEmployeeName('N/A', null, { full_name: 'SACALEANU ANGELICA ELENA' })
    ).toBe('SACALEANU ANGELICA ELENA');
  });

  it('returns "Angajat" when nothing is available', () => {
    expect(resolveEmployeeName(null, null, null)).toBe('Angajat');
    expect(resolveEmployeeName('N/A', null, { full_name: '' })).toBe('Angajat');
  });
});

describe('isUniqueViolation (anti-conflict guard)', () => {
  it('detects Postgres code 23505', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate' })).toBe(true);
  });

  it('detects message containing "duplicate key"', () => {
    expect(isUniqueViolation({ message: 'duplicate key value violates unique constraint' })).toBe(true);
  });

  it('detects message containing "unique"', () => {
    expect(isUniqueViolation({ message: 'unique violation' })).toBe(true);
  });

  it('returns false on unrelated errors', () => {
    expect(isUniqueViolation({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe('isRoleNoop (avoid re-assigning same role)', () => {
  it('returns true when current and new role match', () => {
    expect(isRoleNoop('sef', 'sef')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isRoleNoop('SEF', 'sef')).toBe(true);
  });

  it('returns false for different roles', () => {
    expect(isRoleNoop('user', 'sef')).toBe(false);
  });

  it('handles null/empty current role', () => {
    expect(isRoleNoop(null, 'sef')).toBe(false);
    expect(isRoleNoop('', 'sef')).toBe(false);
  });
});
