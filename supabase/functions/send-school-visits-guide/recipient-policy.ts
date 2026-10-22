export const TEST_RECIPIENT = 'condrea.codrin@icmpp.ro';

export function maySendGuideTest(email: string | undefined, role: string | undefined): boolean {
  return email?.toLowerCase() === TEST_RECIPIENT && role === 'super_admin';
}