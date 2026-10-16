export type MasterPromptSpan = { row: number; span: number };

function cellText(rows: string[][], row: number, column: number): string {
  if (column < 0) return "";
  return String(rows[row]?.[column] ?? "").trim();
}

/**
 * Master prompt is stored on the first shot of a narration.
 * Following shots keep that cell empty and have no voice-over, so the table can merge them.
 */
export function masterPromptRowSpans(input: {
  rows: string[][];
  masterColumn: number;
  voiceColumn: number;
  ranges: Array<{ startRow: number; endRow: number }>;
}): MasterPromptSpan[] {
  if (input.masterColumn < 0 || input.rows.length === 0) return [];
  const groups = input.ranges.length > 0 ? input.ranges : [{ startRow: 0, endRow: input.rows.length }];
  const spans: MasterPromptSpan[] = [];
  for (const range of groups) {
    let row = range.startRow;
    while (row < range.endRow) {
      if (!cellText(input.rows, row, input.masterColumn)) {
        row += 1;
        continue;
      }
      let span = 1;
      while (row + span < range.endRow) {
        const nextMaster = cellText(input.rows, row + span, input.masterColumn);
        const nextVoice = cellText(input.rows, row + span, input.voiceColumn);
        if (nextMaster || nextVoice) break;
        span += 1;
      }
      if (span > 1) spans.push({ row, span });
      row += span;
    }
  }
  return spans;
}
