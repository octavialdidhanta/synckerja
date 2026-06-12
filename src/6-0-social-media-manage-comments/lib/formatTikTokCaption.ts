/**
 * Preserve caption line breaks exactly as authored in TikTok (no inferred splits).
 * TikTok: single \n = baris baru dalam blok yang sama; \n\n = jarak antar paragraf.
 */
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

/** Split only on blank lines (double newline), like TikTok paragraph gaps. */
export function splitTikTokCaptionParagraphs(text: string): string[] {
  const formatted = formatTikTokCaptionForDisplay(text);
  if (!formatted) return [];
  if (!formatted.includes("\n\n")) {
    return [formatted];
  }
  return formatted
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
