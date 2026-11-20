import { describe, expect, it } from 'vitest';
import { canActOnLeaveRequest, withoutOwnLeaveRequests } from './leaveSelfApproval';
import { isOwnLeaveApproval, isOwnLeaveEmail } from '../../supabase/functions/_shared/leave-self-approval';

const tofanId = 'beeae728-b965-406c-a6ca-1ffd0f579d75';
const samoilaId = '2babce60-d010-4036-8332-ee4a57dee7e5';

describe('leave self-approval guards', () => {
  it('blocks Tofan from approving or validating his own request', () => {
    expect(canActOnLeaveRequest(tofanId, tofanId)).toBe(false);
    expect(isOwnLeaveApproval(tofanId, tofanId)).toBe(true);
  });

  it('allows Samoila to approve Tofan’s request', () => {
    expect(canActOnLeaveRequest(tofanId, samoilaId)).toBe(true);
    expect(isOwnLeaveApproval(tofanId, samoilaId)).toBe(false);
  });

  it('does not show an action until the signed-in user is known', () => {
    expect(canActOnLeaveRequest(tofanId, null)).toBe(false);
  });

  it('removes only own requests from the approval list', () => {
    const requests = [{ id: 'own', user_id: tofanId }, { id: 'other', user_id: samoilaId }];
    expect(withoutOwnLeaveRequests(requests, tofanId).map((request) => request.id)).toEqual(['other']);
  });

  it('blocks the requester email regardless of letter case', () => {
    expect(isOwnLeaveEmail('tofan.dragos@icmpp.ro', 'TOFAN.DRAGOS@icmpp.ro')).toBe(true);
    expect(isOwnLeaveEmail('tofan.dragos@icmpp.ro', 'samoila.petrisor@icmpp.ro')).toBe(false);
  });
});
