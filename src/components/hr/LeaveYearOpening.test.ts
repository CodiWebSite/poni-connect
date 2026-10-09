import { describe, it, expect } from 'vitest';
import { STANDARD_DAYS, prevYearLeftover } from './LeaveYearOpening';

describe('deschidere an 2027', () => {
  it('soldul standard este 36 de zile', () => {
    expect(STANDARD_DAYS).toBe(36);
  });
  it('reportul 2026 = sold + bonus - folosite', () => {
    expect(prevYearLeftover(21, 3, 10)).toBe(14);
  });
  it('reportul nu poate fi negativ', () => {
    expect(prevYearLeftover(21, 0, 30)).toBe(0);
  });
});
