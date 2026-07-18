/** Replace Lead Magnet template tokens for phone preview. */

export function interpolatePreviewText(
  text: string,
  vars: { username: string; campaignName?: string },
): string {
  const username = vars.username.trim() || 'Username';
  const campaignName = vars.campaignName?.trim() || 'Campaign';
  return String(text ?? '')
    .replace(/\{\{\s*username\s*\}\}/gi, username)
    .replace(/\{\{\s*campaign_name\s*\}\}/gi, campaignName);
}

export function truncatePreviewLines(text: string, maxChars = 280): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1)}…`;
}
