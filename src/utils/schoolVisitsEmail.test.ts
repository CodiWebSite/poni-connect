import { describe, expect, it } from 'vitest';
import { maySendGuideTest, TEST_RECIPIENT } from '../../supabase/functions/send-school-visits-guide/recipient-policy';

describe('school visits guide test recipient restrictions', () => {
  it('allows only the requested test mailbox with a verified super-admin role', () => {
    expect(TEST_RECIPIENT).toBe('condrea.codrin@icmpp.ro');
    expect(maySendGuideTest('condrea.codrin@icmpp.ro', 'super_admin')).toBe(true);
    expect(maySendGuideTest('harabagiu@icmpp.ro', 'super_admin')).toBe(false);
    expect(maySendGuideTest('condrea.codrin@icmpp.ro', 'user')).toBe(false);
    expect(maySendGuideTest(undefined, 'super_admin')).toBe(false);
  });
});