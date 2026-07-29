/** Normalize a token into a hashtag without leading #. */
export function normalizeHashtagToken(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "");
  return cleaned;
}

function tokenizeSource(text: string): string[] {
  return text
    .split(/[\s\-_/|,.;:!?()[\]{}'"`~]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

/**
 * Derive hashtag suggestions from plan title + content pillar (no AI).
 * Returns tags with leading `#`, max 8, deduped.
 */
export function suggestHashtagsFromPlan(args: {
  title?: string | null;
  contentPillarName?: string | null;
  limit?: number;
}): string[] {
  const limit = args.limit ?? 8;
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const token = normalizeHashtagToken(raw);
    if (!token || token.length < 2) return;
    const key = token.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(`#${token}`);
  };

  const pillar = args.contentPillarName?.trim();
  if (pillar) {
    push(pillar);
    for (const part of tokenizeSource(pillar)) push(part);
  }

  const title = args.title?.trim();
  if (title) {
    for (const part of tokenizeSource(title)) push(part);
  }

  return out.slice(0, limit);
}

export function captionAlreadyHasHashtag(caption: string, tagWithHash: string): boolean {
  const needle = tagWithHash.replace(/^#/, "").toLowerCase();
  if (!needle) return false;
  const re = new RegExp(`(?:^|\\s)#${needle}\\b`, "i");
  return re.test(caption);
}

export function appendHashtagToCaption(caption: string, tagWithHash: string): string {
  const tag = tagWithHash.startsWith("#") ? tagWithHash : `#${tagWithHash}`;
  if (captionAlreadyHasHashtag(caption, tag)) return caption;
  const trimmed = caption.trimEnd();
  if (!trimmed) return tag;
  const needsSpace = !/\s$/.test(caption);
  return `${trimmed}${needsSpace ? " " : ""}${tag}`;
}

export function getActiveHashtagQuery(
  text: string,
  caretIndex: number,
): { query: string; start: number } | null {
  const before = text.slice(0, caretIndex);
  const hashIndex = before.lastIndexOf("#");
  if (hashIndex < 0) return null;
  const between = before.slice(hashIndex + 1);
  if (/\s/.test(between)) return null;
  if (hashIndex > 0 && /[a-zA-Z0-9_]/.test(before[hashIndex - 1] ?? "")) return null;
  return { query: between, start: hashIndex };
}

export function filterHashtagSuggestions(
  suggestions: string[],
  query: string,
): string[] {
  const q = normalizeHashtagToken(query).toLowerCase();
  if (!q) return suggestions.slice(0, 8);
  return suggestions
    .filter((tag) => tag.replace(/^#/, "").toLowerCase().includes(q))
    .slice(0, 8);
}
