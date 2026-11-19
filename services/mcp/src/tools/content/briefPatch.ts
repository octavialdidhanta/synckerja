export type BriefCellField = "timing" | "visual" | "vo" | "element" | "tagging";

export type BriefShotPatch = {
  shotId: string;
  timing?: string;
  visual?: string;
  vo?: string;
  element?: string;
  tagging?: string;
};

export type BriefPatch = {
  shots?: BriefShotPatch[];
  voiceOver?: string;
  caption?: string;
};

export type BriefChange = {
  field: "storyboard" | "concept" | "caption";
  shot_id?: string;
  column?: BriefCellField | "voice_over";
  before: string;
  after: string;
};

export type StoredBriefText = {
  brief: string;
  concept: string;
  caption: string;
  link: string;
  shots: { id: string; rowIndex: number }[];
};

const IMAGE_REF_RE = /!\[|https?:\/\/|storage\/|\.(png|jpe?g|webp|gif|heic)\b/i;

type HeaderKind = BriefCellField | "scene";

function headerKind(header: string): HeaderKind | null {
  const value = header.trim().toLowerCase();
  if (value === "timing") return "timing";
  if (value === "visual") return "visual";
  if (value.startsWith("vo") || value.includes("voice over")) return "vo";
  if (value === "scene visual" || value === "scene" || value.startsWith("scene ")) return "scene";
  if (value.includes("element")) return "element";
  if (value.includes("tag")) return "tagging";
  return null;
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 1 && trimmed.startsWith("|") && trimmed.endsWith("|");
}

function splitCells(line: string): string[] {
  return line.split("|").slice(1, -1).map((part) => part.replace(/<br\s*\/?>/gi, "\n").trim());
}

function isAlign(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^[\s:\-]+$/.test(cell));
}

function encodeCell(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\|/g, "/").replace(/\n/g, "<br>");
}

function replaceCell(line: string, index: number, value: string): string {
  const parts = line.split("|");
  const partIndex = index + 1;
  if (partIndex < 1 || partIndex >= parts.length - 1) throw new Error("invalid_input");
  parts[partIndex] = ` ${encodeCell(value)} `;
  return parts.join("|");
}

function columnFor(headers: string[], field: BriefCellField, cells: string[]): number {
  const kinds = headers.map(headerKind);
  if (field === "visual") {
    const scene = kinds.indexOf("scene");
    if (scene >= 0) return scene;
    const visual = kinds.indexOf("visual");
    if (visual < 0 || IMAGE_REF_RE.test(cells[visual] ?? "")) throw new Error("invalid_input");
    return visual;
  }
  const index = kinds.indexOf(field);
  if (index < 0) throw new Error("invalid_input");
  return index;
}

function findTable(lines: string[]): { headerIndex: number; bodyIndexes: number[] } | null {
  const start = lines.findIndex(isTableLine);
  if (start < 0) return null;
  let headerIndex = -1;
  const bodyIndexes: number[] = [];
  for (let index = start; index < lines.length; index += 1) {
    if (!isTableLine(lines[index])) break;
    const cells = splitCells(lines[index]);
    if (isAlign(cells)) continue;
    if (headerIndex < 0) {
      headerIndex = index;
      continue;
    }
    bodyIndexes.push(index);
  }
  if (headerIndex < 0) return null;
  return { headerIndex, bodyIndexes };
}

const CELL_FIELDS: BriefCellField[] = ["timing", "visual", "vo", "element", "tagging"];

function patchStoryboard(brief: string, shots: StoredBriefText["shots"], patches: BriefShotPatch[]): {
  brief: string;
  changes: BriefChange[];
} {
  const seen = new Set<string>();
  const lines = brief.replace(/\r\n/g, "\n").split("\n");
  const table = findTable(lines);
  if (!table) throw new Error("invalid_input");
  const headers = splitCells(lines[table.headerIndex]);
  const changes: BriefChange[] = [];
  let edited = false;

  for (const patch of patches) {
    if (seen.has(patch.shotId)) throw new Error("invalid_input");
    seen.add(patch.shotId);
    const shot = shots.find((item) => item.id === patch.shotId);
    const lineIndex = shot ? table.bodyIndexes[shot.rowIndex] : undefined;
    if (!shot || lineIndex === undefined) throw new Error("invalid_input");
    let line = lines[lineIndex];
    for (const field of CELL_FIELDS) {
      const next = patch[field];
      if (next === undefined) continue;
      const cells = splitCells(line);
      const column = columnFor(headers, field, cells);
      const before = (cells[column] ?? "").trim();
      const after = next.trim();
      if (before === after) continue;
      line = replaceCell(line, column, after);
      edited = true;
      changes.push({ field: "storyboard", shot_id: patch.shotId, column: field, before, after });
    }
    lines[lineIndex] = line;
  }

  return { brief: edited ? lines.join("\n") : brief, changes };
}

function voiceOverText(concept: string): string {
  if (!concept.trim()) return "";
  try {
    const parsed = JSON.parse(concept) as { voiceOver?: unknown };
    return typeof parsed.voiceOver === "string" ? parsed.voiceOver.trim() : "";
  } catch {
    return "";
  }
}

function patchVoiceOver(concept: string, voiceOver: string): { concept: string; change: BriefChange | null } {
  const after = voiceOver.trim();
  const before = voiceOverText(concept);
  if (before === after) return { concept, change: null };
  if (!concept.trim()) {
    return {
      concept: after ? JSON.stringify({ v: 1, voiceOver: after }) : concept,
      change: { field: "concept", column: "voice_over", before, after },
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(concept);
  } catch {
    throw new Error("invalid_input");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_input");
  const record = { ...(parsed as Record<string, unknown>) };
  if (after) record.voiceOver = after;
  else delete record.voiceOver;
  return {
    concept: JSON.stringify(record),
    change: { field: "concept", column: "voice_over", before, after },
  };
}

/** Apply a cell, voice-over, and caption patch. Unedited text, including the link, stays as stored. */
export function applyBriefPatch(current: StoredBriefText, patch: BriefPatch): StoredBriefText & { changes: BriefChange[] } {
  const storyboard = patch.shots && patch.shots.length > 0
    ? patchStoryboard(current.brief, current.shots, patch.shots)
    : { brief: current.brief, changes: [] as BriefChange[] };
  const voice = patch.voiceOver === undefined
    ? { concept: current.concept, change: null as BriefChange | null }
    : patchVoiceOver(current.concept, patch.voiceOver);
  const caption = patch.caption === undefined || patch.caption.trim() === current.caption.trim()
    ? current.caption
    : patch.caption.trim();
  const changes = [...storyboard.changes];
  if (voice.change) changes.push(voice.change);
  if (caption !== current.caption) {
    changes.push({ field: "caption", before: current.caption.trim(), after: caption.trim() });
  }
  return {
    brief: storyboard.brief,
    concept: voice.concept,
    caption,
    link: current.link,
    shots: current.shots,
    changes,
  };
}
