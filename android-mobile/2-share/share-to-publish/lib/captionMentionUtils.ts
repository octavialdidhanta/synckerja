import { normalizeMentionHandle } from "./captionMentionRecents";

export function getActiveMentionQuery(
  text: string,
  caretIndex: number,
): { query: string; start: number } | null {
  const before = text.slice(0, caretIndex);
  const atIndex = before.lastIndexOf("@");
  if (atIndex < 0) return null;
  const between = before.slice(atIndex + 1);
  if (/\s/.test(between)) return null;
  // Avoid email-like mid-word: require start or non-word before @
  if (atIndex > 0 && /[a-zA-Z0-9_]/.test(before[atIndex - 1] ?? "")) return null;
  return { query: between, start: atIndex };
}

export function insertMentionHandle(
  text: string,
  caretIndex: number,
  handle: string,
): { nextText: string; nextCaret: number } {
  const clean = normalizeMentionHandle(handle);
  const insert = `@${clean} `;
  const active = getActiveMentionQuery(text, caretIndex);
  if (!active) {
    const nextText = text.slice(0, caretIndex) + insert + text.slice(caretIndex);
    return { nextText, nextCaret: caretIndex + insert.length };
  }
  const before = text.slice(0, active.start);
  const after = text.slice(caretIndex);
  const nextText = before + insert + after;
  return { nextText, nextCaret: before.length + insert.length };
}
