import { describe, expect, it } from 'vitest';
import { DESIGNATED_USER_IDS, guideRecipientIds, maySendGuideTest, TEST_RECIPIENT } from '../../supabase/functions/send-school-visits-guide/recipient-policy';

describe('school visits guide test recipient restrictions', () => {
  it('allows only the requested test mailbox with a verified super-admin role', () => {
    expect(TEST_RECIPIENT).toBe('condrea.codrin@icmpp.ro');
    expect(maySendGuideTest('condrea.codrin@icmpp.ro', 'super_admin')).toBe(true);
    expect(maySendGuideTest('harabagiu@icmpp.ro', 'super_admin')).toBe(false);
    expect(maySendGuideTest('condrea.codrin@icmpp.ro', 'user')).toBe(false);
    expect(maySendGuideTest(undefined, 'super_admin')).toBe(false);
  });
});

describe('confirmed school visits guide distribution', () => {
  const accessIds = [...DESIGNATED_USER_IDS];

  it.each([
    ['Valeria Harabagiu', '01efe9ac-60f9-4bc9-bf27-acba1e8fe8c4'],
    ['Petrișor Samoilă', '2babce60-d010-4036-8332-ee4a57dee7e5'],
    ['Mihaela Dascălu', '92276033-a0ad-498c-8305-429399b4b046'],
    ['Mirela Fernanda Zaltariov', 'c9dab90f-fd87-42dc-9fef-8d8c385f622d'],
  ])('includes the designated recipient %s', (_name, id) => {
    expect(guideRecipientIds(accessIds, [])).toContain(id);
  });

  it('includes all super-admins, including Codrin and Cătălin Buzdugan', () => {
    const superAdminIds = ['d36e9878-4f59-409a-b206-7a4d40831e6a', '24b74b77-b092-47f6-9f8b-6f8208dd3111'];
    expect(guideRecipientIds(accessIds, superAdminIds)).toEqual([...accessIds, ...superAdminIds]);
  });

  it('never includes other employees solely because they have visits access', () => {
    expect(guideRecipientIds([...accessIds, 'another-employee'], [])).not.toContain('another-employee');
  });

  it('deduplicates a designated recipient who is also a super-admin', () => {
    expect(guideRecipientIds(accessIds, [accessIds[0]])).toHaveLength(4);
  });

  it('stops distribution when a designated recipient has lost access', () => {
    expect(() => guideRecipientIds(accessIds.slice(1), [])).toThrow();
  });
});