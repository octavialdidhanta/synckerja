/**
 * One row parsed from the AI-generated markdown table for Product Knowledge.
 */
export interface ProductKnowledgeAiRow {
  solution: string;
  customerPersona: string;
  problem: string;
  impact: string;
  wants: string;
  needs: string;
  hiddenNeeds: string;
  falseBelief: string;
  falseBeliefImpact: string;
  whatMakesThemStop: string;
}

const COL_KEYS = [
  'solution',
  'customerPersona',
  'problem',
  'impact',
  'wants',
  'needs',
  'hiddenNeeds',
  'falseBelief',
  'falseBeliefImpact',
  'whatMakesThemStop',
] as const;

/** Header aliases (normalized, lower case) -> field key */
const HEADER_MAP: Record<string, keyof ProductKnowledgeAiRow> = {
  solution: 'solution',
  'customer persona': 'customerPersona',
  problem: 'problem',
  impact: 'impact',
  wants: 'wants',
  needs: 'needs',
  'hidden needs': 'hiddenNeeds',
  'false belief': 'falseBelief',
  'false belief impact': 'falseBeliefImpact',
  'what makes them stop': 'whatMakesThemStop',
};

function normalizeHeader(h: string): string {
  return h.replace(/\?/g, '').trim().toLowerCase();
}

function matchHeaderKey(normalized: string): keyof ProductKnowledgeAiRow | null {
  if (HEADER_MAP[normalized]) return HEADER_MAP[normalized];
  for (const [key] of Object.entries(HEADER_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) return HEADER_MAP[key];
  }
  return null;
}

function parseMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];
  const cells = trimmed
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());
  return cells;
}

/**
 * Parses the AI response string (markdown) and extracts a table with 3 data rows.
 * Returns array of 3 ProductKnowledgeAiRow, or empty array if parsing fails.
 */
export function parseProductKnowledgeAiTable(script: string): ProductKnowledgeAiRow[] {
  const lines = script.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 4) return []; // header + separator + at least 1 row

  let headerLine: string | null = null;
  let separatorIndex = -1;
  const dataLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    const cells = parseMarkdownTableRow(line);
    if (cells.length < 2) continue;
    // Separator row: all cells are dashes (or empty)
    const isSeparator = cells.every((c) => /^-+$/.test(c) || c === '');
    if (isSeparator) {
      if (headerLine == null) continue;
      separatorIndex = i;
      continue;
    }
    if (headerLine == null) {
      headerLine = line;
      continue;
    }
    if (separatorIndex >= 0) {
      dataLines.push(line);
    }
  }

  if (!headerLine || separatorIndex < 0 || dataLines.length === 0) return [];

  const headerCells = parseMarkdownTableRow(headerLine);
  const colIndexToKey: (keyof ProductKnowledgeAiRow)[] = [];

  for (let i = 0; i < headerCells.length; i++) {
    const normalized = normalizeHeader(headerCells[i]);
    const found = matchHeaderKey(normalized);
    colIndexToKey[i] = found ?? (i < COL_KEYS.length ? COL_KEYS[i] : 'solution');
  }

  const result: ProductKnowledgeAiRow[] = [];
  const emptyRow = (): ProductKnowledgeAiRow => ({
    solution: '',
    customerPersona: '',
    problem: '',
    impact: '',
    wants: '',
    needs: '',
    hiddenNeeds: '',
    falseBelief: '',
    falseBeliefImpact: '',
    whatMakesThemStop: '',
  });

  for (const dataLine of dataLines) {
    const cells = parseMarkdownTableRow(dataLine);
    const row = emptyRow();
    for (let i = 0; i < cells.length && i < colIndexToKey.length; i++) {
      const key = colIndexToKey[i];
      if (key && cells[i] !== undefined) {
        row[key] = cells[i].trim();
      }
    }
    result.push(row);
  }

  return result;
}
