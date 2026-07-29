/** Shared hashtag tokenize for edge caption suggest (mirrors mobile captionHashtagSuggest). */

export function normalizeHashtagToken(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "");
}

function tokenizeSource(text: string): string[] {
  return text
    .split(/[\s\-_/|,.;:!?()[\]{}'"`~]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

/** Returns tags with leading #, max limit, deduped. */
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

export function extractHashtagsFromText(text: string): string[] {
  const found = new Set<string>();
  const re = /#([a-zA-Z0-9_]{2,})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const token = normalizeHashtagToken(m[1] ?? "");
    if (token) found.add(token.toLowerCase());
  }
  return [...found];
}

export function extractMentionHandlesFromText(text: string): string[] {
  const found = new Set<string>();
  const re = /(?:^|[\s])@([a-zA-Z0-9._]{2,})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const handle = (m[1] ?? "").trim().replace(/^@+/, "");
    if (handle) found.add(handle.toLowerCase());
  }
  return [...found];
}
