export const COMMENT_REPLY_SLOT_COUNT = 3;

export function normalizeCommentReplyTexts(
  raw: string[] | null | undefined,
  legacy?: string | null,
): string[] {
  const fromArray = Array.isArray(raw)
    ? raw.map((v) => String(v ?? "").trim()).filter(Boolean)
    : [];
  if (fromArray.length > 0) return fromArray.slice(0, COMMENT_REPLY_SLOT_COUNT);

  const legacyText = String(legacy ?? "").trim();
  return legacyText ? [legacyText] : [];
}

export function filledCommentReplyTexts(slots: readonly string[]): string[] {
  return slots.map((v) => String(v ?? "").trim()).filter(Boolean);
}

export function hasDuplicateCommentReplies(slots: readonly string[]): boolean {
  const filled = filledCommentReplyTexts(slots);
  return new Set(filled).size !== filled.length;
}

export function pickRandomCommentReply(slots: readonly string[]): string | null {
  const filled = filledCommentReplyTexts(slots);
  if (filled.length === 0) return null;
  const index = Math.floor(Math.random() * filled.length);
  return filled[index] ?? null;
}
