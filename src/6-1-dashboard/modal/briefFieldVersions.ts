import { isVeoPromptHeader } from "@/6-1-dashboard/lib/seedanceVideo";

export type BriefAuditField = "veo" | "angle" | "visual" | "shot";

export interface BriefFieldVersions {
  row: number;
  field: BriefAuditField;
  versions: string[];
}

const FIELD_VERSIONS_RE = /<!--\s*synckerja-brief-field-versions:([\s\S]*?)\s*-->/;
const FIELDS: BriefAuditField[] = ["shot", "angle", "visual", "veo"];

export function briefAuditField(header: string): BriefAuditField | null {
  if (isVeoPromptHeader(header)) return "veo";
  const normalized = header.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized === "shot" || normalized.startsWith("shot ")) return "shot";
  if (normalized === "angle" || normalized.startsWith("angle ")) return "angle";
  if (normalized.includes("visual function")) return "visual";
  return null;
}

export function fieldVersionKey(row: number, field: BriefAuditField) {
  return `${row}:${field}`;
}

export function sameAuditText(left: string, right: string) {
  return left.replace(/\s+/g, " ").trim() === right.replace(/\s+/g, " ").trim();
}

export function parseBriefFieldVersions(markdown: string): BriefFieldVersions[] {
  const match = FIELD_VERSIONS_RE.exec(markdown);
  if (!match?.[1]) return [];
  try {
    const parsed = JSON.parse(match[1]) as Array<Partial<BriefFieldVersions>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        row: Math.max(0, Number(item.row) || 0),
        field: item.field,
        versions: Array.isArray(item.versions)
          ? item.versions.map((version) => String(version ?? "").trim()).filter(Boolean)
          : [],
      }))
      .filter((item): item is BriefFieldVersions =>
        (item.field === "veo" || item.field === "angle" || item.field === "visual" || item.field === "shot") && item.versions.length >= 2,
      );
  } catch {
    return [];
  }
}

export function upsertBriefFieldVersionsInMarkdown(markdown: string, versions: BriefFieldVersions[]): string {
  const cleaned = versions
    .map((item) => ({
      row: item.row,
      field: item.field,
      versions: item.versions.map((version) => version.trim()).filter(Boolean),
    }))
    .filter((item) => item.versions.length >= 2);
  const comment =
    cleaned.length === 0
      ? ""
      : `<!--synckerja-brief-field-versions:${JSON.stringify(cleaned).replace(/-->/g, "--\\u003e")}-->`;
  const next = String(markdown ?? "").replace(FIELD_VERSIONS_RE, "").trimEnd();
  if (!comment) return next.replace(/\n{3,}/g, "\n\n").trim();
  if (!next) return comment;
  return `${next}\n\n${comment}`;
}

export function stripBriefFieldVersionsComment(markdown: string): string {
  return String(markdown ?? "")
    .replace(FIELD_VERSIONS_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function fieldVersionsFor(history: BriefFieldVersions[], row: number, field: BriefAuditField): string[] {
  return history.find((item) => item.row === row && item.field === field)?.versions ?? [];
}

export function savedFieldSlides(
  history: BriefFieldVersions[],
  row: number,
  field: BriefAuditField,
  cell: string,
): string[] {
  const stored = fieldVersionsFor(history, row, field).filter((version) => version.trim());
  if (stored.length >= 2) return stored;
  const current = cell.trim();
  return current ? [current] : [];
}

function addUniqueSlide(slides: string[], text: string) {
  const trimmed = text.trim();
  if (!trimmed || slides.some((slide) => sameAuditText(slide, trimmed))) return;
  slides.push(trimmed);
}

export type BriefSceneImage = {
  id?: string;
  prompt_override?: string | null;
  shot_text?: string | null;
  angle_text?: string | null;
  visual_function_text?: string | null;
};

export function imageSceneText(image: BriefSceneImage, field: BriefAuditField): string {
  if (field === "shot") return image.shot_text?.trim() ?? "";
  if (field === "angle") return image.angle_text?.trim() ?? "";
  if (field === "visual") return image.visual_function_text?.trim() ?? "";
  return image.prompt_override?.trim() ?? "";
}

/** One line per image, in carousel order. A still without its own line keeps the live cell. */
export function pairedSceneSlides(cell: string, images: BriefSceneImage[], field: BriefAuditField): string[] {
  if (images.length === 0) {
    const current = cell.trim();
    return current ? [current] : [];
  }
  const fallback = cell.trim();
  return images.map((image) => imageSceneText(image, field) || fallback);
}

export function pairedSceneValue(
  cell: string,
  images: BriefSceneImage[],
  field: BriefAuditField,
  activeImageId: string | null | undefined,
): string {
  const slides = pairedSceneSlides(cell, images, field);
  const active = pairedVeoIndex(images, activeImageId);
  return slides[active] ?? cell;
}

/** One Veo line per image, in the same order as the image carousel. */
export function pairedVeoSlides(
  cell: string,
  images: Array<{ prompt_override?: string | null }>,
): string[] {
  return pairedSceneSlides(cell, images, "veo");
}

export function pairedVeoIndex(
  images: Array<{ id?: string }>,
  activeImageId: string | null | undefined,
): number {
  if (images.length === 0) return 0;
  const found = images.findIndex((image) => Boolean(image.id) && image.id === activeImageId);
  return found >= 0 ? found : 0;
}

/** Saved audit history, or the current prompt plus each distinct image prompt. */
export function veoSlidesForRow(
  history: BriefFieldVersions[],
  row: number,
  cell: string,
  images: Array<{ prompt_override?: string | null; created_at?: string | null }>,
): string[] {
  const stored = savedFieldSlides(history, row, "veo", cell);
  if (fieldVersionsFor(history, row, "veo").length >= 2) return stored;
  const slides: string[] = [];
  addUniqueSlide(slides, cell);
  const ordered = [...images].sort((left, right) => String(left.created_at ?? "").localeCompare(String(right.created_at ?? "")));
  for (const image of ordered) addUniqueSlide(slides, image.prompt_override ?? "");
  return slides;
}

export function veoSlideIndex(selected: number | undefined, slides: string[], cell: string): number {
  if (slides.length === 0) return 0;
  if (selected != null && selected >= 0 && selected < slides.length) return selected;
  const current = slides.findIndex((slide) => sameAuditText(slide, cell));
  return current >= 0 ? current : slides.length - 1;
}

/** Keep every older line. A repeated line selects the version that already has it. */
export function appendAuditVersion(versions: string[], next: string): { versions: string[]; created: boolean; index: number } {
  const after = next.trim();
  if (!after) return { versions, created: false, index: Math.max(0, versions.length - 1) };
  const match = versions.findIndex((version) => sameAuditText(version, after));
  if (match >= 0) return { versions, created: false, index: match };
  if (versions.length === 0) return { versions: [after], created: false, index: 0 };
  return { versions: [...versions, after], created: true, index: versions.length };
}

export function commitAuditVersion(versions: string[], previous: string, next: string) {
  const seeded = versions.length > 0 ? versions : (previous.trim() ? [previous.trim()] : []);
  return appendAuditVersion(seeded, next);
}

export function writeFieldVersions(
  history: BriefFieldVersions[],
  row: number,
  field: BriefAuditField,
  versions: string[],
): BriefFieldVersions[] {
  const without = history.filter((item) => item.row !== row || item.field !== field);
  const cleaned = versions.map((version) => version.trim()).filter(Boolean);
  if (cleaned.length < 2) return without;
  return [...without, { row, field, versions: cleaned }].sort((a, b) => a.row - b.row || FIELDS.indexOf(a.field) - FIELDS.indexOf(b.field));
}

export function adjustFieldVersionsForInsertRow(history: BriefFieldVersions[], insertAt: number): BriefFieldVersions[] {
  return history.map((item) => (item.row >= insertAt ? { ...item, row: item.row + 1 } : item));
}

export function adjustFieldVersionsForDeleteRow(history: BriefFieldVersions[], rowIndex: number): BriefFieldVersions[] {
  return history
    .filter((item) => item.row !== rowIndex)
    .map((item) => (item.row > rowIndex ? { ...item, row: item.row - 1 } : item));
}

function shiftKeyedSlides(slides: Record<string, number>, mapRow: (row: number) => number | null): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(slides)) {
    const [rowText, field] = key.split(":");
    const row = Number(rowText);
    const mapped = mapRow(row);
    if (mapped == null || (field !== "veo" && field !== "angle" && field !== "visual" && field !== "shot")) continue;
    next[fieldVersionKey(mapped, field)] = value;
  }
  return next;
}

export function shiftFieldSlideForInsert(slides: Record<string, number>, insertAt: number) {
  return shiftKeyedSlides(slides, (row) => (row >= insertAt ? row + 1 : row));
}

export function shiftFieldSlideForDelete(slides: Record<string, number>, rowIndex: number) {
  return shiftKeyedSlides(slides, (row) => (row === rowIndex ? null : row > rowIndex ? row - 1 : row));
}

export function focusFieldSlides(
  slides: Record<string, number>,
  keys: Array<{ key: string; index: number }>,
) {
  const next = { ...slides };
  for (const item of keys) next[item.key] = item.index;
  return next;
}

export function activeFieldSlide(selected: number | undefined, count: number): number {
  if (count <= 0) return 0;
  if (selected == null || Number.isNaN(selected) || selected < 0 || selected >= count) return count - 1;
  return selected;
}

export interface BriefFieldDraft {
  index: number;
  text: string;
}

export function visibleAuditText(
  history: BriefFieldVersions[],
  rowIndex: number,
  field: BriefAuditField,
  cell: string,
  slides: Record<string, number>,
  drafts: Record<string, BriefFieldDraft>,
): { slides: string[]; active: number; text: string } {
  const stored = savedFieldSlides(history, rowIndex, field, cell);
  const active = activeFieldSlide(slides[fieldVersionKey(rowIndex, field)], stored.length);
  const draft = drafts[fieldVersionKey(rowIndex, field)];
  const text = stored.length > 1
    ? (draft && draft.index === active ? draft.text : (stored[active] ?? cell))
    : cell;
  return { slides: stored, active, text };
}

function shiftDrafts(
  drafts: Record<string, BriefFieldDraft>,
  mapRow: (row: number) => number | null,
): Record<string, BriefFieldDraft> {
  const next: Record<string, BriefFieldDraft> = {};
  for (const [key, value] of Object.entries(drafts)) {
    const [rowText, field] = key.split(":");
    const mapped = mapRow(Number(rowText));
    if (mapped == null || (field !== "veo" && field !== "angle" && field !== "visual" && field !== "shot")) continue;
    next[fieldVersionKey(mapped, field)] = value;
  }
  return next;
}

export function shiftFieldDraftForInsert(drafts: Record<string, BriefFieldDraft>, insertAt: number) {
  return shiftDrafts(drafts, (row) => (row >= insertAt ? row + 1 : row));
}

export function shiftFieldDraftForDelete(drafts: Record<string, BriefFieldDraft>, rowIndex: number) {
  return shiftDrafts(drafts, (row) => (row === rowIndex ? null : row > rowIndex ? row - 1 : row));
}

/** Angle and Visual function fork on save. The Veo column is committed only from image generation. */
export function applyAuditedColumnEdits(input: {
  history: BriefFieldVersions[];
  headers: string[];
  previousBody: string[][];
  nextBody: string[][];
  drafts: Record<string, BriefFieldDraft>;
}): { history: BriefFieldVersions[]; body: string[][]; focus: Array<{ key: string; index: number }> } {
  const body = input.nextBody.map((row) => [...row]);
  let history = input.history;
  const focus: Array<{ key: string; index: number }> = [];
  input.headers.forEach((header, col) => {
    const field = briefAuditField(header);
    if (field !== "angle" && field !== "visual") return;
    const rowCount = Math.max(input.previousBody.length, body.length);
    for (let row = 0; row < rowCount; row++) {
      const previous = String(input.previousBody[row]?.[col] ?? "");
      const draft = input.drafts[fieldVersionKey(row, field)];
      const typed = draft ? draft.text : String(body[row]?.[col] ?? "");
      if (!draft && sameAuditText(previous, typed)) continue;
      const committed = commitAuditVersion(fieldVersionsFor(history, row, field), previous, typed);
      if (!body[row]) body[row] = [];
      while (body[row].length <= col) body[row].push("");
      if (!committed.created) {
        if (committed.versions.length >= 2) {
          body[row][col] = previous;
          focus.push({ key: fieldVersionKey(row, field), index: committed.index });
        } else if (!sameAuditText(previous, typed) && typed.trim()) {
          body[row][col] = typed.trim();
        } else {
          body[row][col] = previous;
        }
        continue;
      }
      history = writeFieldVersions(history, row, field, committed.versions);
      body[row][col] = typed.trim();
      focus.push({ key: fieldVersionKey(row, field), index: committed.index });
    }
  });
  return { history, body, focus };
}
