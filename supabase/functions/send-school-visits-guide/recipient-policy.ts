export const TEST_RECIPIENT = 'condrea.codrin@icmpp.ro';

export function maySendGuideTest(email: string | undefined, role: string | undefined): boolean {
  return email?.toLowerCase() === TEST_RECIPIENT && role === 'super_admin';
}

export const DESIGNATED_USER_IDS = [
  '01efe9ac-60f9-4bc9-bf27-acba1e8fe8c4', // Valeria Harabagiu
  '2babce60-d010-4036-8332-ee4a57dee7e5', // Petrișor Samoilă
  '92276033-a0ad-498c-8305-429399b4b046', // Mihaela Dascălu
  'c9dab90f-fd87-42dc-9fef-8d8c385f622d', // Mirela Fernanda Zaltariov
  'beeae728-b965-406c-a6ca-1ffd0f579d75', // Dragoș Tofan
] as const;

export function guideRecipientIds(accessIds: string[], superAdminIds: string[]): string[] {
  const designated = DESIGNATED_USER_IDS.filter(id => accessIds.includes(id));
  if (designated.length !== DESIGNATED_USER_IDS.length) {
    throw new Error('A designated recipient no longer has school visits access');
  }
  return [...new Set([...designated, ...superAdminIds])];
}