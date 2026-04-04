import { stringifyMarkdownTable } from '@/6-1-dashboard/utils/markdownTableUtils';
import { parseMarkdownTable } from '@/6-1-dashboard/utils/markdownTableUtils';

/** Normalize whitespace for matching: collapse multiple spaces/newlines to single space, trim */
function normalizeForMatch(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Merge revised part back into full script.
 * @param fullScript - The complete script
 * @param originalText - The text that was revised
 * @param revisedText - The AI-revised text
 * @param startIndex - Optional: start index of original in fullScript (from section parser)
 * @param endIndex - Optional: end index of original in fullScript
 * @returns Updated full script
 */
export function mergeRevisedPart(
  fullScript: string,
  originalText: string,
  revisedText: string,
  startIndex?: number,
  endIndex?: number
): string {
  // When we have indices from section parser, ALWAYS use them - section content may be
  // transformed (trimmed, stripped) for display but indices point to the correct range
  if (startIndex !== undefined && endIndex !== undefined && startIndex >= 0 && endIndex <= fullScript.length) {
    return fullScript.slice(0, startIndex) + revisedText + fullScript.slice(endIndex);
  }

  // From text selection: find originalText in fullScript
  const exactIdx = fullScript.indexOf(originalText);
  if (exactIdx >= 0) {
    return fullScript.slice(0, exactIdx) + revisedText + fullScript.slice(exactIdx + originalText.length);
  }

  // Fallback: try trimmed original (handles extra whitespace from selection)
  const trimmedOriginal = originalText.trim();
  if (trimmedOriginal) {
    const trimmedIdx = fullScript.indexOf(trimmedOriginal);
    if (trimmedIdx >= 0) {
      return fullScript.slice(0, trimmedIdx) + revisedText + fullScript.slice(trimmedIdx + trimmedOriginal.length);
    }
  }

  // Fallback: try normalized - search for original with flexible whitespace
  const normOriginal = normalizeForMatch(originalText);
  if (normOriginal.length >= 10 && normOriginal.length < 5000) {
    try {
      const pattern = normOriginal
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
      const regex = new RegExp(pattern);
      const match = fullScript.match(regex);
      if (match && match.index !== undefined) {
        const matchEnd = match.index + match[0].length;
        return fullScript.slice(0, match.index) + revisedText + fullScript.slice(matchEnd);
      }
    } catch {
      // Regex too complex or invalid - skip
    }
  }

  // Could not find - return fullScript unchanged (caller should handle error)
  return fullScript;
}

export interface TableCellRevision {
  tableStartIndex: number;
  tableEndIndex: number;
  rowIndex: number;
  colIndex: number;
  revisedCellValue: string;
  /** Optional: use section's tableData when re-parse yields fewer rows (avoids rowIndex mismatch) */
  tableData?: string[][];
}

export interface TableRowRevision {
  tableStartIndex: number;
  tableEndIndex: number;
  rowIndex: number;
  revisedRowMarkdown: string;
  /** Optional: use section's tableData when re-parse yields fewer rows (avoids rowIndex mismatch) */
  tableData?: string[][];
}

/**
 * Parse a markdown table row line into cells (e.g. "| a | b | c |" -> ["a","b","c"])
 */
function parseRowLine(line: string): string[] {
  const parts = line.trim().split('|');
  return parts
    .slice(1, -1)
    .map((p) => p.trim());
}

/** True if this row of cells looks like the table header (Timing | VO | Visual | ...) */
function isTableHeaderRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  const first = (cells[0] ?? '').trim().toLowerCase();
  if (first === 'timing') return true;
  const second = (cells[1] ?? '').trim().toLowerCase();
  if (second.includes('voice over') || second === 'vo') return true;
  return false;
}

/**
 * Merge a full table row revision into the full script.
 * - Skips header row in AI response so only data row is used; never replaces row 0 (header).
 * - Ensures newline before table so "Breakdown Script ###" does not fuse with header line.
 */
export function mergeTableRowRevision(
  fullScript: string,
  params: TableRowRevision
): string {
  const { tableStartIndex, tableEndIndex, rowIndex, revisedRowMarkdown, tableData } = params;
  if (rowIndex === 0) return fullScript;

  const tableMarkdown = fullScript.slice(tableStartIndex, tableEndIndex);
  const parsed = parseMarkdownTable(tableMarkdown);
  const baseTable = tableData && rowIndex < tableData.length
    ? tableData
    : parsed?.table;
  if (!baseTable || !baseTable[rowIndex]) return fullScript;

  const lines = revisedRowMarkdown.trim().split('\n').filter((l) => l.trim());
  let newCells: string[] = [];
  for (const line of lines) {
    if (!line.trim().startsWith('|') || !line.trim().endsWith('|')) continue;
    const cells = parseRowLine(line);
    const isAlignment = cells.length > 0 && cells.every((c) => /^[\s:\-]+$/.test(c));
    if (isAlignment) continue;
    if (cells.length > 0 && isTableHeaderRow(cells)) continue;
    if (cells.length > 0) {
      newCells = cells;
      break;
    }
  }
  // Fallback: AI returned plain text without table format - use as VO cell (column 1)
  if (newCells.length === 0 && revisedRowMarkdown.trim()) {
    const existingRow = baseTable[rowIndex] ?? [];
    if (existingRow.length > 0) {
      newCells = [...existingRow];
      const voCol = existingRow.length > 1 ? 1 : 0;
      newCells[voCol] = revisedRowMarkdown.trim();
    }
  }
  if (newCells.length === 0) return fullScript;

  const colCount = baseTable[0]?.length ?? newCells.length;
  while (newCells.length < colCount) newCells.push('');
  if (newCells.length > colCount) newCells = newCells.slice(0, colCount);

  const newTable = baseTable.map((r, ri) =>
    ri === rowIndex ? newCells : r
  );
  const newTableMarkdown = stringifyMarkdownTable(newTable);

  const before = fullScript.slice(0, tableStartIndex);
  const after = fullScript.slice(tableEndIndex);
  const needsNewline =
    before.length > 0 &&
    !before.endsWith('\n') &&
    newTableMarkdown.length > 0 &&
    !newTableMarkdown.startsWith('\n');
  return before + (needsNewline ? '\n' : '') + newTableMarkdown + after;
}

/**
 * Merge a single table cell revision into the full script.
 */
export function mergeTableCellRevision(
  fullScript: string,
  params: TableCellRevision
): string {
  const { tableStartIndex, tableEndIndex, rowIndex, colIndex, revisedCellValue, tableData } = params;
  const tableMarkdown = fullScript.slice(tableStartIndex, tableEndIndex);
  const parsed = parseMarkdownTable(tableMarkdown);
  // Prefer section tableData when rowIndex valid there (avoids re-parse mismatch)
  const baseTable = tableData && rowIndex < tableData.length
    ? tableData
    : parsed?.table;
  if (!baseTable || !baseTable[rowIndex]) return fullScript;

  const row = baseTable[rowIndex];
  if (colIndex >= row.length) return fullScript;

  const newTable = baseTable.map((r, ri) =>
    ri === rowIndex
      ? r.map((c, ci) => (ci === colIndex ? revisedCellValue : c))
      : r
  );
  const newTableMarkdown = stringifyMarkdownTable(newTable);
  const before = fullScript.slice(0, tableStartIndex);
  const after = fullScript.slice(tableEndIndex);
  const needsNewline =
    before.length > 0 &&
    !before.endsWith('\n') &&
    newTableMarkdown.length > 0 &&
    !newTableMarkdown.startsWith('\n');
  return before + (needsNewline ? '\n' : '') + newTableMarkdown + after;
}

export interface TableRowDelete {
  tableStartIndex: number;
  tableEndIndex: number;
  /** 1-based: 0 = header, 1 = first data row. Header cannot be deleted. */
  rowIndex: number;
  tableData?: string[][];
}

/**
 * Remove a single table row from the full script.
 * rowIndex: 0 = header, 1 = first data row. Only data rows (rowIndex >= 1) are removed.
 */
export function deleteTableRow(fullScript: string, params: TableRowDelete): string {
  const { tableStartIndex, tableEndIndex, rowIndex, tableData } = params;
  if (rowIndex < 1) return fullScript;
  const tableMarkdown = fullScript.slice(tableStartIndex, tableEndIndex);
  const parsed = parseMarkdownTable(tableMarkdown);
  const baseTable =
    tableData && rowIndex < tableData.length ? tableData : parsed?.table;
  if (!baseTable || !baseTable[rowIndex]) return fullScript;

  const newTable = baseTable.filter((_, i) => i !== rowIndex);
  if (newTable.length === 0) return fullScript;
  const newTableMarkdown = stringifyMarkdownTable(newTable);
  const before = fullScript.slice(0, tableStartIndex);
  const after = fullScript.slice(tableEndIndex);
  const needsNewline =
    before.length > 0 &&
    !before.endsWith('\n') &&
    newTableMarkdown.length > 0 &&
    !newTableMarkdown.startsWith('\n');
  return before + (needsNewline ? '\n' : '') + newTableMarkdown + after;
}
