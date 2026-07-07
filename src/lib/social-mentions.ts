// Extract mentioned user IDs from social content that uses @[Name](user:UUID) markers.
const MENTION_RE = /@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)/g;

export function extractMentionUserIds(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) {
    if (m[2]) set.add(m[2]);
  }
  return Array.from(set);
}

export function stripMentionMarkup(text: string): string {
  return text.replace(MENTION_RE, '@$1');
}
