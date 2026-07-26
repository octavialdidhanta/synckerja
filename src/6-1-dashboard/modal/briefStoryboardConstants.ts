export const DEFAULT_BRIEF_STORYBOARD_HEADERS = [
  'Timing',
  'Visual',
  'VO (Voice Over)',
  'Element Lainnya',
  'Tagging',
] as const;

export const DEFAULT_BRIEF_STORYBOARD_COLUMN_COUNT = DEFAULT_BRIEF_STORYBOARD_HEADERS.length;
export const DEFAULT_BRIEF_STORYBOARD_ROW_COUNT = 3;
export const MAX_BRIEF_STORYBOARD_COLUMNS = 12;
export const MAX_BRIEF_STORYBOARD_ROWS = 50;

/** Canonical index of the Visual / paste-image column after normalization. */
export const BRIEF_STORYBOARD_CANONICAL_IMAGE_COLUMN_INDEX = 1;

export function defaultColumnNameAt(index: number): string {
  return DEFAULT_BRIEF_STORYBOARD_HEADERS[index] ?? `Column ${index + 1}`;
}

export function buildStoryboardTable(headers: string[], initialRowCount: number): string[][] {
  const cols = headers.map((h) => h.trim()).filter(Boolean);
  const safeCols = cols.length > 0 ? cols : [...DEFAULT_BRIEF_STORYBOARD_HEADERS];
  const rows = Math.max(1, Math.min(initialRowCount, MAX_BRIEF_STORYBOARD_ROWS));
  return [safeCols, ...Array.from({ length: rows }, () => safeCols.map(() => ''))];
}

function normalizeHeaderKey(header: string): string {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function isBriefTimingHeader(header: string): boolean {
  const h = normalizeHeaderKey(header);
  return h === 'timing' || h === 'no' || h === '#' || h === 'no.';
}

/** Paste-image column — exact "Visual" only (not Voice Over / Scene Visual). */
export function isBriefVisualHeader(header: string): boolean {
  const h = normalizeHeaderKey(header);
  return h === 'visual';
}

export function isBriefVoHeader(header: string): boolean {
  const h = normalizeHeaderKey(header);
  if (!h) return false;
  return (
    h === 'vo' ||
    h.startsWith('vo ') ||
    h.includes('voice over') ||
    h === 'narasi' ||
    h.includes('narasi')
  );
}

export function isBriefElementHeader(header: string): boolean {
  const h = normalizeHeaderKey(header);
  return h.includes('element') || h.includes('lainnya') || h.includes('other');
}

export function isBriefTaggingHeader(header: string): boolean {
  const h = normalizeHeaderKey(header);
  return h.includes('tag');
}

/**
 * Resolve paste-image column by header name (Visual).
 * Falls back to canonical index 1 only when that slot is not a VO column.
 */
export function findBriefImageColumnIndex(headers: string[]): number {
  const list = headers.map((h) => String(h ?? ''));
  const visualIdx = list.findIndex(isBriefVisualHeader);
  if (visualIdx >= 0) return visualIdx;

  const fallback = BRIEF_STORYBOARD_CANONICAL_IMAGE_COLUMN_INDEX;
  if (list.length > fallback && isBriefVoHeader(list[fallback] ?? '')) {
    // Avoid treating VO as the image slot when Visual header is missing.
    const voIdx = list.findIndex(isBriefVoHeader);
    if (voIdx >= 0 && voIdx + 1 < list.length) return voIdx + 1;
    return Math.max(0, Math.min(fallback, list.length - 1));
  }
  if (list.length === 0) return 0;
  return Math.max(0, Math.min(fallback, list.length - 1));
}

export function findBriefVoColumnIndex(headers: string[]): number {
  const list = headers.map((h) => String(h ?? ''));
  const idx = list.findIndex(isBriefVoHeader);
  if (idx >= 0) return idx;
  const imageIdx = findBriefImageColumnIndex(list);
  const preferred = imageIdx + 1;
  return Math.max(0, Math.min(preferred, Math.max(list.length - 1, 0)));
}

/**
 * Reorder a storyboard table to canonical headers:
 * Timing | Visual | VO (Voice Over) | Element Lainnya | Tagging | …extras
 *
 * Remaps cells by header name so AI tables like Timing|VO|Visual keep VO text.
 * Body cells in the Visual (paste) column are cleared — images live in storage.
 */
export function normalizeBriefStoryboardTable(table: string[][]): string[][] {
  if (!table.length) return table;

  const rawHeaders = (table[0] ?? []).map((h) => String(h ?? '').trim());
  if (rawHeaders.length === 0) return table;

  const body = table.slice(1);
  const timingIdx = rawHeaders.findIndex(isBriefTimingHeader);
  const visualIdx = rawHeaders.findIndex(isBriefVisualHeader);
  const voIdx = rawHeaders.findIndex(isBriefVoHeader);
  const elementIdx = rawHeaders.findIndex(isBriefElementHeader);
  const taggingIdx = rawHeaders.findIndex(isBriefTaggingHeader);

  const used = new Set<number>(
    [timingIdx, visualIdx, voIdx, elementIdx, taggingIdx].filter((i) => i >= 0),
  );
  const extras = rawHeaders
    .map((header, index) => ({ header, index }))
    .filter(({ header, index }) => header.length > 0 && !used.has(index));

  const outHeaders: string[] = [
    DEFAULT_BRIEF_STORYBOARD_HEADERS[0],
    DEFAULT_BRIEF_STORYBOARD_HEADERS[1],
    DEFAULT_BRIEF_STORYBOARD_HEADERS[2],
  ];

  const cellAt = (row: string[], index: number) =>
    index >= 0 ? String(row[index] ?? '') : '';

  /** Sample whether any body row carries Visual text (scene description from AI). */
  const hasVisualText = body.some((row) => cellAt(row, visualIdx).trim().length > 0);
  if (hasVisualText) {
    outHeaders.push('Scene Visual');
  }
  outHeaders.push(
    DEFAULT_BRIEF_STORYBOARD_HEADERS[3],
    DEFAULT_BRIEF_STORYBOARD_HEADERS[4],
    ...extras.map((e) => e.header),
  );

  const outBody = body.map((row) => {
    const padded = [...row];
    while (padded.length < rawHeaders.length) padded.push('');
    const visualText = cellAt(padded, visualIdx);
    const cells = [
      cellAt(padded, timingIdx),
      '', // Visual = paste-image slot (images live in brief_storyboard_images)
      cellAt(padded, voIdx),
    ];
    if (hasVisualText) {
      cells.push(visualText);
    }
    cells.push(
      cellAt(padded, elementIdx),
      cellAt(padded, taggingIdx),
      ...extras.map((e) => cellAt(padded, e.index)),
    );
    return cells;
  });

  return [outHeaders, ...outBody];
}

/** True when header row already matches Timing | Visual | VO … */
export function isBriefStoryboardTableCanonical(table: string[][]): boolean {
  if (!table.length) return true;
  const headers = table[0] ?? [];
  if (headers.length < 3) return false;
  return (
    isBriefTimingHeader(headers[0] ?? '') &&
    isBriefVisualHeader(headers[1] ?? '') &&
    isBriefVoHeader(headers[2] ?? '')
  );
}
