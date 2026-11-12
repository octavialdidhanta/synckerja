const GLUE = new Set([
  "dan",
  "atau",
  "yang",
  "dengan",
  "the",
  "of",
  "and",
  "or",
  "a",
  "an",
]);

function contentWords(raw: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const token of raw.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (!token || GLUE.has(token) || seen.has(token)) continue;
    seen.add(token);
    words.push(token);
  }
  return words;
}

/** Same words, or one wording only adds words to the other. */
export function sameWording(left: string, right: string): boolean {
  const normalized = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const aText = normalized(left);
  const bText = normalized(right);
  if (aText && aText === bText) return true;
  const a = contentWords(left);
  const b = contentWords(right);
  if (a.length === 0 || b.length === 0) return false;
  if ([...a].sort().join("\0") === [...b].sort().join("\0")) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length < 2) return false;
  const pool = new Set(longer);
  const hits = shorter.filter((word) => pool.has(word)).length;
  if (shorter.length <= 6) return hits === shorter.length;
  return hits / shorter.length >= 0.85;
}
