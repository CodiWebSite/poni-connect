import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

describe('authentication email destination', () => {
  it.each(['signup', 'invite'])('%s links the institution to the intranet without changing the action URL', async (type) => {
    const source = readFileSync('supabase/functions/auth-email-hook/index.ts', 'utf8');
    const config = await import('../../supabase/functions/_shared/auth-email-config');
    let options: Record<string, any> = {};
    const execute = new Function('React', 'createAuthEmailHandler', 'Deno', 'AUTH_EMAIL_CONFIG',
      'SignupEmail', 'InviteEmail', 'MagicLinkEmail', 'RecoveryEmail', 'EmailChangeEmail', 'ReauthenticationEmail',
      source.replace(/^import .*$/gm, '').replace(/\/\/ Template mapping[\s\S]*?(?=\/\/ The SDK handler)/, '')
        .replace(/!([,;])/g, '$1').replace(/Deno\.serve\([\s\S]*$/, ''));
    execute({ createElement: (_: unknown, props: unknown) => props }, (value: typeof options) => { options = value; },
      { env: { get: vi.fn() } }, config.AUTH_EMAIL_CONFIG,
      'signup', 'invite', 'magiclink', 'recovery', 'email_change', 'reauthentication');
    const actionUrl = 'https://intranet.icmpp.ro/auth?token=test';
    const props = options.emails[type].render({ email: 'employee@example.test', url: actionUrl });
    expect(props.siteUrl).toBe('https://intranet.icmpp.ro');
    expect(props.confirmationUrl).toBe(actionUrl);
    expect(options.senderDomain).toBe('notify.djfunkyevents.ro');
    expect(options.from).toBe('Intranet ICMPP <noreply@djfunkyevents.ro>');
  });
});