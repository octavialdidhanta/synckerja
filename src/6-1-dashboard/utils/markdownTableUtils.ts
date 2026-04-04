/**
 * Utilities for parsing and stringifying markdown tables in brief content.
 */

/**
 * Check if a table row is an alignment row (e.g. | --- | --- |)
 */
function isAlignmentRow(cells: string[]): boolean {
  return cells.every((cell) => /^[\s:\-]+$/.test(cell.trim()));
}

/**
 * Parse a single table row into cells.
 * Handles | a | b | c | format.
 */
function parseTableRow(line: string): string[] {
  const parts = line.split('|');
  return parts
    .slice(1, -1)
    .map((p) => p.trim());
}

/**
 * Find and parse the first markdown table in the given markdown string.
 * Returns table data (2D array), start index, and end index in the original string.
 */
export function parseMarkdownTable(
  markdown: string
): { table: string[][]; startIndex: number; endIndex: number } | null {
  const lines = markdown.split('\n');
  let startLineIdx = -1;
  const rows: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
      if (rows.length > 0) break;
      continue;
    }

    const cells = parseTableRow(line);
    if (cells.length === 0) continue;

    if (startLineIdx < 0) startLineIdx = i;

    if (rows.length >= 1 && isAlignmentRow(cells)) {
      continue;
    }

    rows.push(cells);
  }

  if (rows.length < 1) return null;

  const beforeTable = lines.slice(0, startLineIdx).join('\n');
  const startIndex = beforeTable.length;

  let endLineIdx = startLineIdx;
  while (endLineIdx < lines.length) {
    const line = lines[endLineIdx];
    const t = line.trim();
    if (!t.startsWith('|') || !t.endsWith('|')) break;
    const cells = parseTableRow(line);
    if (endLineIdx > startLineIdx && cells.length > 0 && isAlignmentRow(cells)) {
      endLineIdx++;
      continue;
    }
    endLineIdx++;
  }

  const tableLines = lines.slice(startLineIdx, endLineIdx);
  const endIndex = startIndex + tableLines.join('\n').length;

  const tableRows = tableLines
    .map((l) => parseTableRow(l))
    .filter((cells) => cells.length > 0 && !isAlignmentRow(cells));

  return {
    table: tableRows,
    startIndex,
    endIndex,
  };
}

/**
 * Convert 2D array to markdown table string.
 * Trims trailing fully-empty rows so save does not duplicate bottom rows.
 */
export function stringifyMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return '';

  const colCount = Math.max(...rows.map((r) => r.length));
  const isRowEmpty = (r: string[]) => r.length <= 0 || r.every((c) => (c ?? '').trim() === '');
  let trimmedRows = rows;
  while (trimmedRows.length > 1 && isRowEmpty(trimmedRows[trimmedRows.length - 1])) {
    trimmedRows = trimmedRows.slice(0, -1);
  }

  const pad = (arr: string[]) => {
    const a = [...arr];
    while (a.length < colCount) a.push('');
    return a;
  };

  const escapeCell = (s: string) => {
    return String(s ?? '').replace(/\n/g, ' ');
  };

  const padded = trimmedRows.map((r) => pad(r.map(escapeCell)));
  const header = padded[0];
  const body = padded.slice(1);

  const alignRow = header.map(() => '---').join(' | ');
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${alignRow} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ];
  return lines.join('\n');
}

/**
 * Replace a table in the markdown string with new table content.
 * Ensures a newline between content-before and the new table when the content
 * before ends without newline (e.g. "---" horizontal rule), so the parser
 * does not see "---| Timing |" as one malformed line.
 */
export function replaceTableInMarkdown(
  brief: string,
  newTableMarkdown: string,
  startIndex: number,
  endIndex: number
): string {
  const before = brief.slice(0, startIndex);
  const after = brief.slice(endIndex);
  const needsNewline =
    before.length > 0 &&
    !before.endsWith('\n') &&
    newTableMarkdown.length > 0 &&
    !newTableMarkdown.startsWith('\n');
  return before + (needsNewline ? '\n' : '') + newTableMarkdown + after;
}
