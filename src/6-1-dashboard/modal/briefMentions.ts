import type { BriefConceptDocument } from "@/6-1-dashboard/modal/briefConceptAssets";

export type MentionKind = "character" | "location" | "property";

export type ConceptMention = {
  handle: string;
  description: string;
  kind: MentionKind;
};

export type MentionRange = {
  start: number;
  end: number;
  handle: string;
};

export type MentionQuery = {
  start: number;
  end: number;
  query: string;
};

const TOKEN = /@[a-z0-9_]+/gi;

export function conceptMentions(document: BriefConceptDocument | null | undefined): ConceptMention[] {
  if (!document) return [];
  const rows = (kind: MentionKind, items: Array<{ handle: string; description: string }>) =>
    items.flatMap((item) => {
      const handle = item.handle.trim();
      if (!handle.startsWith("@")) return [];
      return [{ handle, description: item.description.trim(), kind }];
    });
  return [
    ...rows("character", document.characters),
    ...rows("location", document.locations),
    ...rows("property", document.properties),
  ];
}

export function mentionRanges(text: string, handles: string[]): MentionRange[] {
  const known = new Map(handles.map((handle) => [handle.toLowerCase(), handle]));
  const ranges: MentionRange[] = [];
  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    const canonical = known.get(token.toLowerCase());
    if (!canonical || match.index == null) continue;
    ranges.push({ start: match.index, end: match.index + token.length, handle: canonical });
  }
  return ranges;
}

export function mentionQueryAt(text: string, caret: number, ranges: MentionRange[]): MentionQuery | null {
  if (ranges.some((range) => caret > range.start && caret < range.end)) return null;
  const match = /@[a-z0-9_]*$/i.exec(text.slice(0, caret));
  if (!match) return null;
  const start = caret - match[0].length;
  if (ranges.some((range) => range.start === start && range.end === caret)) return null;
  return { start, end: caret, query: match[0].slice(1) };
}

export function filterMentions(mentions: ConceptMention[], query: string): ConceptMention[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return mentions;
  return mentions.filter((item) => {
    const handle = item.handle.toLowerCase();
    return handle.includes(needle) || handle.slice(1).includes(needle) || item.description.toLowerCase().includes(needle);
  });
}

export function insertMention(text: string, query: MentionQuery, handle: string): { text: string; caret: number } {
  const token = handle.startsWith("@") ? handle : `@${handle}`;
  const nextChar = text[query.end] ?? "";
  const gap = nextChar && !/\s/.test(nextChar) ? " " : "";
  const inserted = `${token}${gap}`;
  return {
    text: text.slice(0, query.start) + inserted + text.slice(query.end),
    caret: query.start + inserted.length,
  };
}

export function expandToMentions(start: number, end: number, ranges: MentionRange[]): { start: number; end: number } {
  let nextStart = start;
  let nextEnd = Math.max(start, end);
  let changed = true;
  while (changed) {
    changed = false;
    for (const range of ranges) {
      const collapsedInside = nextStart === nextEnd && range.start < nextStart && nextStart < range.end;
      const partial =
        nextStart !== nextEnd &&
        range.start < nextEnd &&
        range.end > nextStart &&
        (range.start < nextStart || range.end > nextEnd);
      if (!collapsedInside && !partial) continue;
      const startEdge = Math.min(nextStart, range.start);
      const endEdge = Math.max(nextEnd, range.end);
      if (startEdge !== nextStart || endEdge !== nextEnd) changed = true;
      nextStart = startEdge;
      nextEnd = endEdge;
    }
  }
  return { start: nextStart, end: nextEnd };
}

export function atomicDelete(
  text: string,
  start: number,
  end: number,
  ranges: MentionRange[],
  key: "Backspace" | "Delete",
): { text: string; caret: number } | null {
  if (start !== end) {
    const expanded = expandToMentions(start, end, ranges);
    if (expanded.start === start && expanded.end === end) return null;
    return { text: text.slice(0, expanded.start) + text.slice(expanded.end), caret: expanded.start };
  }
  const hit =
    key === "Backspace"
      ? ranges.find((range) => range.start < start && start <= range.end)
      : ranges.find((range) => range.start <= start && start < range.end);
  if (!hit) return null;
  return { text: text.slice(0, hit.start) + text.slice(hit.end), caret: hit.start };
}
