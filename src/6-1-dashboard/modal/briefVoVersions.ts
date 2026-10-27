import { isBriefVoHeader } from "./briefStoryboardConstants";
import { stripBriefFieldVersionsComment } from "./briefFieldVersions";
import { stripBriefSceneMetaComment } from "./briefSceneMeta";
import { stripBriefSequencesComment } from "./briefSequences";

export interface BriefVoVersions {
  row: number;
  versions: string[];
}

const VO_VERSIONS_RE = /<!--\s*synckerja-brief-vo-versions:([\s\S]*?)\s*-->/;

export function briefVersionName(index: number): string {
  return index <= 0 ? "Original" : `V.${index}`;
}

export function parseBriefVoVersions(markdown: string): BriefVoVersions[] {
  const match = VO_VERSIONS_RE.exec(markdown);
  if (!match?.[1]) return [];
  try {
    const parsed = JSON.parse(match[1]) as Array<Partial<BriefVoVersions>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        row: Math.max(0, Number(item.row) || 0),
        versions: Array.isArray(item.versions)
          ? item.versions.map((version) => String(version ?? "").trim()).filter(Boolean)
          : [],
      }))
      .filter((item) => item.versions.length >= 2);
  } catch {
    return [];
  }
}

export function upsertBriefVoVersionsInMarkdown(markdown: string, versions: BriefVoVersions[]): string {
  const cleaned = versions
    .map((item) => ({
      row: item.row,
      versions: item.versions.map((version) => version.trim()).filter(Boolean),
    }))
    .filter((item) => item.versions.length >= 2);
  const comment =
    cleaned.length === 0
      ? ""
      : `<!--synckerja-brief-vo-versions:${JSON.stringify(cleaned).replace(/-->/g, "--\\u003e")}-->`;
  let next = String(markdown ?? "").replace(VO_VERSIONS_RE, "").trimEnd();
  if (!comment) return next.replace(/\n{3,}/g, "\n\n").trim();
  if (!next) return comment;
  return `${next}\n\n${comment}`;
}

export function stripBriefVoVersionsComment(markdown: string): string {
  return String(markdown ?? "")
    .replace(VO_VERSIONS_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function stripBriefStorageComments(markdown: string): string {
  return stripBriefFieldVersionsComment(
    stripBriefVoVersionsComment(stripBriefSceneMetaComment(stripBriefSequencesComment(markdown))),
  );
}

/** Keep every previously saved line and append the new one. */
export function rememberVoVersion(
  history: BriefVoVersions[],
  row: number,
  previous: string,
  next: string,
): BriefVoVersions[] {
  const before = previous.trim();
  const after = next.trim();
  if (!after || before === after) return history;
  const current = history.find((item) => item.row === row)?.versions ?? [];
  let versions = current.map((version) => version.trim()).filter(Boolean);
  if (before && (versions.length === 0 || versions[versions.length - 1] !== before)) {
    versions = [...versions, before];
  }
  if (versions.length === 0 || versions[versions.length - 1] !== after) {
    versions = [...versions, after];
  }
  if (versions.length < 2) return history;
  return [...history.filter((item) => item.row !== row), { row, versions }].sort((a, b) => a.row - b.row);
}

export function rememberVoVersions(
  history: BriefVoVersions[],
  headers: string[],
  previousBody: string[][],
  nextBody: string[][],
): { history: BriefVoVersions[]; changedRows: number[] } {
  const column = headers.findIndex((header) => isBriefVoHeader(String(header ?? "")));
  if (column < 0) return { history, changedRows: [] };
  let nextHistory = history;
  const changedRows: number[] = [];
  const rows = Math.max(previousBody.length, nextBody.length);
  for (let row = 0; row < rows; row += 1) {
    const updated = rememberVoVersion(
      nextHistory,
      row,
      previousBody[row]?.[column] ?? "",
      nextBody[row]?.[column] ?? "",
    );
    if (updated !== nextHistory) {
      nextHistory = updated;
      changedRows.push(row);
    }
  }
  return { history: nextHistory, changedRows };
}

/** The VO line that covers this shot. Later shots with an empty VO cell keep the previous line. */
export function narrationAnchorRow(rows: string[][], voiceColumn: number, rowIndex: number): number {
  if (voiceColumn < 0 || rows.length === 0 || rowIndex < 0) return -1;
  let anchor = Math.min(rowIndex, rows.length - 1);
  while (anchor > 0 && !String(rows[anchor]?.[voiceColumn] ?? "").trim()) anchor -= 1;
  return String(rows[anchor]?.[voiceColumn] ?? "").trim() ? anchor : -1;
}

export function savedVoSlides(history: BriefVoVersions[], row: number, cell: string): string[] {
  const stored = history.find((item) => item.row === row)?.versions.filter((version) => version.trim()) ?? [];
  if (stored.length >= 2) return stored;
  const current = cell.trim();
  return current ? [current] : [];
}

function narrationKey(value: string) {
  return value.replace(/\[[^\]\n]{0,80}\]/g, " ").replace(/\s+/g, " ").trim();
}

/** The newest clip spoken from this line. Audio tags do not hide the player. */
export function clipForNarration<T extends { spoken_text: string | null }>(
  clipsNewestFirst: T[],
  narration: string,
): T | null {
  const wanted = narrationKey(narration);
  if (!wanted) return null;
  return clipsNewestFirst.find((clip) => clip.spoken_text && narrationKey(clip.spoken_text) === wanted) ?? null;
}

export function activeVoSlide(selected: number | undefined, count: number): number {
  if (count <= 0) return 0;
  if (selected == null || selected < 0 || selected >= count) return count - 1;
  return selected;
}

export function adjustVoVersionsForInsertRow(history: BriefVoVersions[], insertAt: number): BriefVoVersions[] {
  return history.map((item) => (item.row >= insertAt ? { ...item, row: item.row + 1 } : item));
}

export function adjustVoVersionsForDeleteRow(history: BriefVoVersions[], rowIndex: number): BriefVoVersions[] {
  return history
    .filter((item) => item.row !== rowIndex)
    .map((item) => (item.row > rowIndex ? { ...item, row: item.row - 1 } : item));
}

export function shiftVoSlideForInsert(
  slides: Record<number, number>,
  insertAt: number,
): Record<number, number> {
  const next: Record<number, number> = {};
  for (const [key, value] of Object.entries(slides)) {
    const row = Number(key);
    next[row >= insertAt ? row + 1 : row] = value;
  }
  return next;
}

export function shiftVoSlideForDelete(
  slides: Record<number, number>,
  rowIndex: number,
): Record<number, number> {
  const next: Record<number, number> = {};
  for (const [key, value] of Object.entries(slides)) {
    const row = Number(key);
    if (row === rowIndex) continue;
    next[row > rowIndex ? row - 1 : row] = value;
  }
  return next;
}

export function focusLatestVoSlides(
  slides: Record<number, number>,
  history: BriefVoVersions[],
  rows: number[],
): Record<number, number> {
  const next = { ...slides };
  for (const row of rows) {
    const count = history.find((item) => item.row === row)?.versions.length ?? 1;
    next[row] = Math.max(0, count - 1);
  }
  return next;
}
