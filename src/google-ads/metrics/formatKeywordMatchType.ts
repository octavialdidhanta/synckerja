/** Google Ads KeywordMatchType enum (numeric API values). */
const MATCH_TYPE_BY_NUMBER: Record<number, string> = {
  2: "exact",
  3: "phrase",
  4: "broad",
};

/** Canonical lowercase key for sorting (must match edge `formatKeywordMatchTypeForSort`). */
export function keywordMatchTypeSortKey(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const mapped = MATCH_TYPE_BY_NUMBER[raw];
    if (mapped) return mapped;
  }
  const s = String(raw).trim();
  if (!s) return "";
  const asNum = Number(s);
  if (Number.isFinite(asNum) && MATCH_TYPE_BY_NUMBER[asNum]) {
    return MATCH_TYPE_BY_NUMBER[asNum];
  }
  return s
    .replace(/^KEYWORD_MATCH_TYPE_/i, "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

/** Display label for Match type column. */
export function formatKeywordMatchType(raw: unknown): string {
  const key = keywordMatchTypeSortKey(raw);
  if (!key) return "—";
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}
