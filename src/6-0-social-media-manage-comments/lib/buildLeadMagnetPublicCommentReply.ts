/** Mirror lead-magnet runtime: personalize public comment reply with @mention. */
export function buildLeadMagnetPublicCommentReply(text: string, username: string | null): string {
  const handle = (username ?? '').trim().replace(/^@/, '');
  if (!handle) return text;
  const mention = `@${handle}`;
  if (text.includes(mention)) return text;
  return `${mention} ${text}`;
}
