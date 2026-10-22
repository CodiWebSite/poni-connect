import { describe, it, expect } from 'vitest';
import { resolveVisitStatus, monthLabel } from './schoolVisits';

describe('resolveVisitStatus', () => {
  it('registration number means approved', () => expect(resolveVisitStatus({ approval_no: '4464/29.09.2026' })).toBe('aprobata'));
  it('"cerere data la semnat" means in signing', () => expect(resolveVisitStatus({ approval_no: 'cerere data la semnat' })).toBe('semnare'));
  it('"intentie transmisa" means intention', () => expect(resolveVisitStatus({ approval_no: 'intentie transmisa' })).toBe('intentie'));
  it('cancelled wins', () => expect(resolveVisitStatus({ approval_no: '1/2', cancelled_at: '2026-10-01' })).toBe('anulata'));
  it('manual status overrides', () => expect(resolveVisitStatus({ approval_no: '', status: 'aprobata' })).toBe('aprobata'));
  it('month label', () => expect(monthLabel('2026-11-24')).toBe('LUNA NOIEMBRIE 2026'));
});
