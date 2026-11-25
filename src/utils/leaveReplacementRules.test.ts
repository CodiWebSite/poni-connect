import { describe, expect, it } from 'vitest';
import { canTransferDelegation, hasBlockingReplacementConflict } from './leaveReplacementRules';

const period = { start_date: '2026-12-02', end_date: '2026-12-07' };

describe('disponibilitatea înlocuitorului', () => {
  it('blochează un concediu aprobat care se suprapune', () => {
    expect(hasBlockingReplacementConflict([{ ...period, status: 'approved' }], '2026-12-04', '2026-12-08')).toBe(true);
  });

  it('blochează o cerere în așteptare care se suprapune', () => {
    expect(hasBlockingReplacementConflict([{ ...period, status: 'pending_department_head' }], '2026-12-01', '2026-12-03')).toBe(true);
  });

  it('nu blochează o cerere respinsă sau o perioadă separată', () => {
    expect(hasBlockingReplacementConflict([{ ...period, status: 'rejected' }], '2026-12-04', '2026-12-08')).toBe(false);
    expect(hasBlockingReplacementConflict([{ ...period, status: 'approved' }], '2026-12-08', '2026-12-10')).toBe(false);
  });
});

describe('transferul ștafetei', () => {
  const delegation = {
    delegate_user_id: 'ebcea4c3-bed6-4960-bb27-4f43303094b3',
    is_active: true,
    end_date: '2026-12-07',
  };

  it('permite lui Lucian Tabără transferul delegării active primite', () => {
    expect(canTransferDelegation(delegation, 'ebcea4c3-bed6-4960-bb27-4f43303094b3', '2026-12-02')).toBe(true);
  });

  it('nu permite transferul de alt utilizator sau după expirare', () => {
    expect(canTransferDelegation(delegation, '50c33275-d49f-48a4-a9f9-ad6f36b70d4b', '2026-12-02')).toBe(false);
    expect(canTransferDelegation(delegation, delegation.delegate_user_id, '2026-12-08')).toBe(false);
  });
});
