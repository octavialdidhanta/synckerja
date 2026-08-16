export interface BriefSequence {
  id: string;
  name: string;
  /** Number of consecutive body rows belonging to this sequence. */
  rowCount: number;
}

const SEQUENCES_COMMENT_RE =
  /<!--\s*synckerja-brief-sequences:(\[[\s\S]*?\])\s*-->/;

function createSequenceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `seq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createBriefSequence(name: string, rowCount = 0): BriefSequence {
  return {
    id: createSequenceId(),
    name,
    rowCount: Math.max(0, rowCount),
  };
}

export function createDefaultBriefSequences(rowCount: number, defaultName = 'Sequence 1'): BriefSequence[] {
  return [createBriefSequence(defaultName, Math.max(0, rowCount))];
}

/**
 * Ensure sequence rowCounts sum to bodyRowCount without dropping named sequences.
 * Extra rows go to the last sequence; surplus empty sequences keep rowCount 0.
 */
export function normalizeBriefSequences(
  sequences: BriefSequence[] | null | undefined,
  bodyRowCount: number,
  defaultName = 'Sequence 1',
): BriefSequence[] {
  const safeCount = Math.max(0, bodyRowCount);
  if (!sequences || sequences.length === 0) {
    return createDefaultBriefSequences(safeCount, defaultName);
  }

  const next = sequences.map((seq) => ({
    ...seq,
    id: seq.id || createSequenceId(),
    name: (seq.name || '').trim() || defaultName,
    rowCount: Math.max(0, Number(seq.rowCount) || 0),
  }));

  let assigned = next.reduce((sum, seq) => sum + seq.rowCount, 0);
  if (assigned < safeCount) {
    next[next.length - 1] = {
      ...next[next.length - 1],
      rowCount: next[next.length - 1].rowCount + (safeCount - assigned),
    };
  } else if (assigned > safeCount) {
    let overflow = assigned - safeCount;
    for (let i = next.length - 1; i >= 0 && overflow > 0; i -= 1) {
      const take = Math.min(next[i].rowCount, overflow);
      next[i] = { ...next[i], rowCount: next[i].rowCount - take };
      overflow -= take;
    }
  }

  return next;
}

export function getSequenceRowRanges(
  sequences: BriefSequence[],
): Array<{ sequence: BriefSequence; startRow: number; endRow: number }> {
  let cursor = 0;
  return sequences.map((sequence) => {
    const startRow = cursor;
    const endRow = cursor + sequence.rowCount;
    cursor = endRow;
    return { sequence, startRow, endRow };
  });
}

export function findSequenceIndexForRow(sequences: BriefSequence[], rowIndex: number): number {
  let cursor = 0;
  for (let i = 0; i < sequences.length; i += 1) {
    const next = cursor + sequences[i].rowCount;
    if (rowIndex >= cursor && rowIndex < next) return i;
    // Empty sequence occupies a "gap" at cursor — treat insert-at-cursor as this sequence
    if (sequences[i].rowCount === 0 && rowIndex === cursor) return i;
    cursor = next;
  }
  return Math.max(0, sequences.length - 1);
}

/** Increment the sequence that owns the row we inserted after. */
export function adjustSequencesForInsertRow(
  sequences: BriefSequence[],
  insertAfterRowIndex: number,
): BriefSequence[] {
  const next = sequences.map((s) => ({ ...s }));
  const ownerRow = insertAfterRowIndex >= 0 ? insertAfterRowIndex : 0;
  const seqIdx = findSequenceIndexForRow(next, ownerRow);
  next[seqIdx] = { ...next[seqIdx], rowCount: next[seqIdx].rowCount + 1 };
  return next;
}

export function adjustSequencesForDeleteRow(
  sequences: BriefSequence[],
  rowIndex: number,
): BriefSequence[] {
  const next = sequences.map((s) => ({ ...s }));
  const seqIdx = findSequenceIndexForRow(next, rowIndex);
  if (next[seqIdx].rowCount > 0) {
    next[seqIdx] = { ...next[seqIdx], rowCount: next[seqIdx].rowCount - 1 };
  }
  return next;
}

export function parseBriefSequencesFromMarkdown(markdown: string): BriefSequence[] | null {
  const match = SEQUENCES_COMMENT_RE.exec(markdown);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]) as Array<Partial<BriefSequence>>;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map((item, index) => ({
      id: typeof item.id === 'string' && item.id ? item.id : createSequenceId(),
      name: typeof item.name === 'string' && item.name.trim() ? item.name : `Sequence ${index + 1}`,
      rowCount: Math.max(0, Number(item.rowCount) || 0),
    }));
  } catch {
    return null;
  }
}

export function upsertBriefSequencesInMarkdown(
  markdown: string,
  sequences: BriefSequence[],
): string {
  const payload = JSON.stringify(
    sequences.map((seq) => ({
      id: seq.id,
      name: seq.name,
      rowCount: seq.rowCount,
    })),
  );
  const comment = `<!--synckerja-brief-sequences:${payload}-->`;
  if (SEQUENCES_COMMENT_RE.test(markdown)) {
    return markdown.replace(SEQUENCES_COMMENT_RE, comment);
  }
  const trimmed = markdown.trimEnd();
  if (!trimmed) return comment;
  return `${trimmed}\n\n${comment}`;
}

/** Remove sequence metadata comment so it never shows in titles or prose. */
export function stripBriefSequencesComment(markdown: string): string {
  return String(markdown ?? '')
    .replace(SEQUENCES_COMMENT_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
