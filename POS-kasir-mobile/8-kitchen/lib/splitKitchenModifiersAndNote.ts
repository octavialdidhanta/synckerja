/** Marker prefix used when kitchen notes are appended into `modifiers_text`. */
export const KITCHEN_NOTE_TEXT_MARKER = "Catatan:";

/**
 * Split KDS `modifiers_text` into variant/mods vs kitchen note for display.
 * Notes are appended as `… · Catatan: …` by `kitchenModifiersTextFromCartLine`.
 */
export function splitKitchenModifiersAndNote(text: string): {
  modifiers: string | null;
  note: string | null;
} {
  const raw = text.trim();
  if (!raw) return { modifiers: null, note: null };

  const idx = raw.indexOf(KITCHEN_NOTE_TEXT_MARKER);
  if (idx < 0) {
    return { modifiers: raw, note: null };
  }

  const before = raw.slice(0, idx).replace(/\s*·\s*$/, "").trim();
  const after = raw.slice(idx + KITCHEN_NOTE_TEXT_MARKER.length).trim();
  return {
    modifiers: before || null,
    note: after || null,
  };
}
