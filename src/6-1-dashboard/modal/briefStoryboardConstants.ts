export const DEFAULT_BRIEF_STORYBOARD_HEADERS = [
  'Timing',
  'VO (Voice Over)',
  'Visual',
  'Element Lainnya',
  'Tagging',
] as const;

export const DEFAULT_BRIEF_STORYBOARD_COLUMN_COUNT = DEFAULT_BRIEF_STORYBOARD_HEADERS.length;
export const DEFAULT_BRIEF_STORYBOARD_ROW_COUNT = 3;
export const MAX_BRIEF_STORYBOARD_COLUMNS = 12;
export const MAX_BRIEF_STORYBOARD_ROWS = 50;

export function defaultColumnNameAt(index: number): string {
  return DEFAULT_BRIEF_STORYBOARD_HEADERS[index] ?? `Column ${index + 1}`;
}

export function buildStoryboardTable(headers: string[], initialRowCount: number): string[][] {
  const cols = headers.map((h) => h.trim()).filter(Boolean);
  const safeCols = cols.length > 0 ? cols : [...DEFAULT_BRIEF_STORYBOARD_HEADERS];
  const rows = Math.max(1, Math.min(initialRowCount, MAX_BRIEF_STORYBOARD_ROWS));
  return [safeCols, ...Array.from({ length: rows }, () => safeCols.map(() => ''))];
}
