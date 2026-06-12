/** Keep in sync with src/6-0-social-media-manage-comments/lib/formatTikTokCaption.ts */
export function formatTikTokCaptionForDisplay(text: string): string {
  if (!text) return "";

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u2028/g, "\n")
    .replace(/\u2029/g, "\n\n")
    .replace(/\\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function normalizeTikTokCaptionFromApi(caption?: string): string | undefined {
  if (!caption?.trim()) return undefined;
  return formatTikTokCaptionForDisplay(caption);
}
