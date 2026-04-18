/** WhatsApp Cloud API body uses `{{1}}`, `{{2}}`, … placeholders. */

export function sortedUniqueVariableIndices(text: string): number[] {
  const re = /\{\{(\d+)\}\}/g;
  const set = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

export function maxVariableIndex(text: string): number {
  const xs = sortedUniqueVariableIndices(text);
  return xs.length ? xs[xs.length - 1]! : 0;
}

/** Next index for BODY (sequential usage: max + 1). */
export function nextBodyVariableIndex(body: string): number {
  return maxVariableIndex(body) + 1;
}

/** Variables must be {{1}}..{{n}} with no gaps (Meta expectation). */
export function validateSequentialVariables(text: string, label: string): string | null {
  const indices = sortedUniqueVariableIndices(text);
  if (indices.length === 0) return null;
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] !== i + 1) {
      return `${label}: gunakan {{1}}, {{2}}, … berurutan tanpa nomor yang terlewat.`;
    }
  }
  return null;
}

export function insertSnippetAtSelection(
  value: string,
  start: number,
  end: number,
  snippet: string,
): { next: string; caret: number } {
  const next = value.slice(0, start) + snippet + value.slice(end);
  return { next, caret: start + snippet.length };
}

export function wrapSelection(
  value: string,
  start: number,
  end: number,
  wrapBefore: string,
  wrapAfter: string,
): { next: string; caretStart: number; caretEnd: number } {
  const selected = value.slice(start, end);
  const innerStart = start + wrapBefore.length;
  if (start === end) {
    const next = value.slice(0, start) + wrapBefore + wrapAfter + value.slice(end);
    return { next, caretStart: innerStart, caretEnd: innerStart };
  }
  const next = value.slice(0, start) + wrapBefore + selected + wrapAfter + value.slice(end);
  const caretEnd = innerStart + selected.length;
  return { next, caretStart: innerStart, caretEnd };
}
