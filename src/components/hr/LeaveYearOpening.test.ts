import { describe, it, expect } from 'vitest';
import { STANDARD_DAYS, prevYearLeftover } from './LeaveYearOpening';
import { canOpenLeaveYear } from '@/utils/leaveYearOpeningDate';

describe('deschidere an 2027', () => {
  it('soldul standard este 35 de zile', () => {
    expect(STANDARD_DAYS).toBe(35);
  });
  it('reportul 2026 = sold + bonus - folosite', () => {
    expect(prevYearLeftover(21, 3, 10)).toBe(14);
  });
  it('reportul nu poate fi negativ', () => {
    expect(prevYearLeftover(21, 0, 30)).toBe(0);
  });
  it('nu permite deschiderea 2027 înainte de 1 ianuarie în România', () => {
    expect(canOpenLeaveYear(2027, new Date('2026-10-22T06:07:00Z'))).toBe(false);
    expect(canOpenLeaveYear(2027, new Date('2026-12-31T21:59:59Z'))).toBe(false);
  });
  it('permite deschiderea de la 1 ianuarie 2027 ora României', () => {
    expect(canOpenLeaveYear(2027, new Date('2026-12-31T22:00:00Z'))).toBe(true);
    expect(canOpenLeaveYear(2027, new Date('2027-01-01T10:00:00Z'))).toBe(true);
  });
});
