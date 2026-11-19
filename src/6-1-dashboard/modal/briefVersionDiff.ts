import { parseBriefConcept } from "./briefConceptAssets";

export type BriefDiffLine = {
  kind: "same" | "add" | "remove";
  text: string;
};

const DIFF_LINE_CAP = 400;

export function voiceOverFromConcept(raw: string | null | undefined): string {
  return parseBriefConcept(raw ?? "")?.voiceOver?.trim() ?? "";
}

export function diffLines(before: string, after: string): BriefDiffLine[] {
  const previous = before.split("\n");
  const next = after.split("\n");
  if (previous.length > DIFF_LINE_CAP || next.length > DIFF_LINE_CAP) {
    return [
      ...previous.map((text) => ({ kind: "remove" as const, text })),
      ...next.map((text) => ({ kind: "add" as const, text })),
    ];
  }

  const rows = previous.length;
  const columns = next.length;
  const scores: number[][] = Array.from({ length: rows + 1 }, () => Array(columns + 1).fill(0));
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      scores[row][column] = previous[row] === next[column]
        ? scores[row + 1][column + 1] + 1
        : Math.max(scores[row + 1][column], scores[row][column + 1]);
    }
  }

  const lines: BriefDiffLine[] = [];
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (previous[row] === next[column]) {
      lines.push({ kind: "same", text: previous[row] });
      row += 1;
      column += 1;
    } else if (scores[row + 1][column] >= scores[row][column + 1]) {
      lines.push({ kind: "remove", text: previous[row] });
      row += 1;
    } else {
      lines.push({ kind: "add", text: next[column] });
      column += 1;
    }
  }
  while (row < rows) {
    lines.push({ kind: "remove", text: previous[row] });
    row += 1;
  }
  while (column < columns) {
    lines.push({ kind: "add", text: next[column] });
    column += 1;
  }
  return lines;
}

export function diffHasChanges(lines: BriefDiffLine[]): boolean {
  return lines.some((line) => line.kind !== "same");
}
