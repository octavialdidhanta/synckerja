export type UndoEntry = { value: string; caret: number };

export type UndoHistory = {
  entries: UndoEntry[];
  index: number;
  typedAt: number;
};

const COALESCE_MS = 800;
const MAX_ENTRIES = 100;

export function createUndoHistory(value: string): UndoHistory {
  return { entries: [{ value, caret: value.length }], index: 0, typedAt: 0 };
}

/** Typing in one burst stays one step. A pause, or a mention insert, starts the next step. */
export function pushUndo(
  history: UndoHistory,
  value: string,
  caret: number,
  now: number,
  coalesce: boolean,
): UndoHistory {
  const entries = history.entries.slice(0, history.index + 1);
  const last = entries[entries.length - 1];
  if (last?.value === value) {
    entries[entries.length - 1] = { value, caret };
    return { entries, index: entries.length - 1, typedAt: coalesce ? now : 0 };
  }
  const merge =
    coalesce && history.typedAt > 0 && now - history.typedAt < COALESCE_MS && entries.length >= 2;
  if (merge) entries[entries.length - 1] = { value, caret };
  else entries.push({ value, caret });
  const trimmed = entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries;
  return { entries: trimmed, index: trimmed.length - 1, typedAt: coalesce ? now : 0 };
}

export function moveUndo(history: UndoHistory, direction: -1 | 1): UndoHistory | null {
  const index = history.index + direction;
  if (index < 0 || index >= history.entries.length) return null;
  return { ...history, index, typedAt: 0 };
}
