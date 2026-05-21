/** Metadata di `habit_entries.notes` untuk completion checklist harian (indeks 0-based). */
export const HABIT_CHECKLIST_INDEX_NOTE_PREFIX = "checklist_index:";

export function formatHabitChecklistIndexNote(index: number): string {
  return `${HABIT_CHECKLIST_INDEX_NOTE_PREFIX}${index}`;
}

export function parseHabitChecklistIndexNote(notes?: string | null): number | null {
  if (!notes || !notes.startsWith(HABIT_CHECKLIST_INDEX_NOTE_PREFIX)) return null;
  const parsed = Number.parseInt(notes.slice(HABIT_CHECKLIST_INDEX_NOTE_PREFIX.length), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/** Bangun state checkbox dari entri yang ada; dukung data lama tanpa indeks (isi dari atas). */
export function buildChecklistCheckedState(
  existingEntries: { notes?: string | null }[],
  targetCount: number,
): boolean[] {
  const initial = new Array<boolean>(targetCount).fill(false);
  if (targetCount <= 0 || existingEntries.length === 0) return initial;

  const parsedIndices = existingEntries.map((e) => parseHabitChecklistIndexNote(e.notes));
  const hasIndexedEntries = parsedIndices.some((idx) => idx !== null);

  if (hasIndexedEntries) {
    for (const idx of parsedIndices) {
      if (idx !== null && idx < targetCount) initial[idx] = true;
    }
    return initial;
  }

  for (let i = 0; i < Math.min(existingEntries.length, targetCount); i += 1) {
    initial[i] = true;
  }
  return initial;
}
