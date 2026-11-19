import { narrationKey } from "../../../../../src/6-1-dashboard/modal/narrationKey";

/** The line a row was spoken from: its vo cell, or the full voice over when that cell is empty. */
export function narrationSource(vo: string | null | undefined, voiceOver: string | null | undefined): string {
  const cell = vo?.trim() ?? "";
  if (cell) return cell;
  return voiceOver?.trim() ?? "";
}

/** True when the stored ElevenLabs line no longer matches the current source. Audio tags and extra spaces do not count. */
export function voiceClipStale(spokenText: string | null | undefined, source: string | null | undefined): boolean {
  return narrationKey(spokenText ?? "") !== narrationKey(source ?? "");
}
