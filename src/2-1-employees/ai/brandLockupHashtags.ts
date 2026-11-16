/** Normalize Brand lockup hashtags for UI + RPC (ASCII #Tag). */

const TAG_RE = /^#[A-Za-z0-9_]{1,47}$/;
const MAX_TAGS = 30;

export function normalizeBrandHashtags(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input)
    ? input
    : String(input ?? "").split(/[\s,]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    let tag = String(item ?? "").trim();
    if (!tag) continue;
    if (!tag.startsWith("#")) tag = `#${tag}`;
    tag = tag.replace(/[^#A-Za-z0-9_]/g, "").slice(0, 48);
    if (!TAG_RE.test(tag)) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Empty is allowed. Non-empty raw must yield at least one valid tag. */
export function brandHashtagsValid(tags: string[], rawText = ""): boolean {
  if (!rawText.trim()) return true;
  return tags.length > 0;
}

export function brandHashtagsLabel(tags: string[]): string {
  return tags.join(" ");
}
