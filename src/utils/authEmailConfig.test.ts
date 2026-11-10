import { describe, expect, it } from 'vitest';
import { AUTH_EMAIL_CONFIG } from '../../supabase/functions/_shared/auth-email-config';

describe('Institutional authentication sender', () => {
  it('uses the requested sender domain', () => {
    expect(AUTH_EMAIL_CONFIG.senderDomain).toBe('notify.intranet.icmpp.ro');
  });

  it('keeps the From address on the verified sender domain', () => {
    const addressDomain = AUTH_EMAIL_CONFIG.fromAddress.split('@')[1]?.replace('>', '');
    expect(addressDomain).toBe(AUTH_EMAIL_CONFIG.senderDomain);
  });
});