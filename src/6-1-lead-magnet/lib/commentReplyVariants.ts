export const COMMENT_REPLY_SLOT_COUNT = 3;

export type CommentReplyTextsTuple = [string, string, string];

export function emptyCommentReplySlots(): CommentReplyTextsTuple {
  return ['', '', ''];
}

export function normalizeCommentReplyTexts(
  raw: string[] | null | undefined,
  legacy?: string | null,
): string[] {
  const fromArray = Array.isArray(raw)
    ? raw.map((v) => String(v ?? '').trim()).filter(Boolean)
    : [];
  if (fromArray.length > 0) return fromArray.slice(0, COMMENT_REPLY_SLOT_COUNT);

  const legacyText = String(legacy ?? '').trim();
  return legacyText ? [legacyText] : [];
}

export function toCommentReplySlots(
  raw: string[] | null | undefined,
  legacy?: string | null,
): CommentReplyTextsTuple {
  const normalized = normalizeCommentReplyTexts(raw, legacy);
  const slots = emptyCommentReplySlots();
  for (let i = 0; i < COMMENT_REPLY_SLOT_COUNT; i++) {
    slots[i] = normalized[i] ?? '';
  }
  return slots;
}

export function filledCommentReplyTexts(slots: readonly string[]): string[] {
  return slots.map((v) => String(v ?? '').trim()).filter(Boolean);
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

export function syncCommentReplyLegacyMirror(slots: CommentReplyTextsTuple): string {
  return filledCommentReplyTexts(slots)[0] ?? '';
}
