import { parseMarkdownTable } from "../../../../../src/6-1-dashboard/utils/markdownTableUtils";
import {
  normalizeBriefSequences,
  parseBriefSequencesFromMarkdown,
} from "../../../../../src/6-1-dashboard/modal/briefSequences";

/** One storyboard row. Known columns get fixed keys; any other column lands in `extra`. */
export type BriefShot = {
  timing: string;
  visual: string;
  vo: string;
  scene: string;
  element: string;
  tagging: string;
  has_image: boolean;
  extra?: Record<string, string>;
};

export type BriefStoryboard = {
  columns: string[];
  shot_count: number;
  sequences: Array<{ name: string; shots: BriefShot[] }>;
  truncated: boolean;
};

export type ParsedBrief = {
  storyboard: BriefStoryboard | null;
  notes: string | null;
};

const MAX_CELL = 1500;
const MAX_NOTES = 4000;
const MAX_SHOTS = 60;
/** Hidden editor comments (sequences, scene meta with ids) are not notes. */
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
/** Image cells hold storage references; only say an image exists, never return the reference. */
const IMAGE_REF_RE = /!\[|https?:\/\/|storage\/|\.(png|jpe?g|webp|gif|heic)\b/i;

type ColumnKey = "timing" | "visual" | "vo" | "scene" | "element" | "tagging";

function columnKey(header: string): ColumnKey | null {
  const value = header.trim().toLowerCase();
  if (value === "timing") return "timing";
  if (value === "visual") return "visual";
  if (value.startsWith("vo") || value.includes("voice over")) return "vo";
  if (value === "scene visual") return "scene";
  if (value === "element lainnya" || value === "element") return "element";
  if (value === "tagging") return "tagging";
  return null;
}

function cleanCell(value: string | undefined): string {
  const text = String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .trim();
  return text.length > MAX_CELL ? `${text.slice(0, MAX_CELL)}…` : text;
}

function emptyShot(): BriefShot {
  return { timing: "", visual: "", vo: "", scene: "", element: "", tagging: "", has_image: false };
}

function toShot(headers: string[], cells: string[]): BriefShot {
  const shot = emptyShot();
  const extra: Record<string, string> = {};
  headers.forEach((header, index) => {
    const value = cleanCell(cells[index]);
    const key = columnKey(header);
    if (key === "visual") {
      if (IMAGE_REF_RE.test(value)) shot.has_image = true;
      else shot.visual = value;
      return;
    }
    if (key) {
      shot[key] = value;
      return;
    }
    const label = header.trim() || `Column ${index + 1}`;
    if (value && !/^column \d+$/i.test(label)) extra[label] = value;
  });
  if (Object.keys(extra).length > 0) shot.extra = extra;
  return shot;
}

function isBlank(shot: BriefShot): boolean {
  return (
    !shot.has_image &&
    !shot.timing &&
    !shot.visual &&
    !shot.vo &&
    !shot.scene &&
    !shot.element &&
    !shot.tagging &&
    !shot.extra
  );
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 1 && trimmed.startsWith("|") && trimmed.endsWith("|");
}

/** Text around the first table block (the block parseMarkdownTable reads as the storyboard). */
function withoutFirstTable(source: string): string {
  const lines = source.split("\n");
  const start = lines.findIndex(isTableLine);
  if (start < 0) return source;
  let end = start;
  while (end < lines.length && isTableLine(lines[end])) end += 1;
  return [...lines.slice(0, start), ...lines.slice(end)].join("\n");
}

/**
 * Read the stored brief markdown the same way the content page does:
 * the first markdown table is the storyboard, the hidden comment splits its rows into sequences,
 * and any text outside the table is returned as notes.
 */
export function parseStoredBrief(markdown: string | null | undefined): ParsedBrief {
  const source = String(markdown ?? "").replace(/\r\n/g, "\n");
  if (!source.trim()) return { storyboard: null, notes: null };

  const parsed = parseMarkdownTable(source);
  const outside = parsed ? withoutFirstTable(source) : source;
  const notesText = outside.replace(HTML_COMMENT_RE, "").trim();
  const notes = notesText
    ? notesText.length > MAX_NOTES
      ? `${notesText.slice(0, MAX_NOTES)}…`
      : notesText
    : null;

  if (!parsed || parsed.table.length < 2) return { storyboard: null, notes };

  const [headerRow, ...bodyRows] = parsed.table;
  const headers = headerRow.map((cell) => cell.trim());
  const sequences = normalizeBriefSequences(parseBriefSequencesFromMarkdown(source), bodyRows.length);

  let cursor = 0;
  let kept = 0;
  let truncated = false;
  const grouped: BriefStoryboard["sequences"] = [];
  for (const sequence of sequences) {
    const rows = bodyRows.slice(cursor, cursor + sequence.rowCount);
    cursor += sequence.rowCount;
    const shots: BriefShot[] = [];
    for (const row of rows) {
      const shot = toShot(headers, row);
      if (isBlank(shot)) continue;
      if (kept >= MAX_SHOTS) {
        truncated = true;
        break;
      }
      shots.push(shot);
      kept += 1;
    }
    if (shots.length > 0) grouped.push({ name: sequence.name, shots });
  }

  return {
    storyboard: {
      columns: headers.filter((header) => header && !/^column \d+$/i.test(header)),
      shot_count: kept,
      sequences: grouped,
      truncated,
    },
    notes,
  };
}
