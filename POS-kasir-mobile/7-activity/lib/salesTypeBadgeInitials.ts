/**
 * Badge initials for a sales type name (mockup: "Dine In" → "In", "Take Away" → "Ay").
 * Uses the last word: first+last char when longer than 2 letters, else up to 2 chars.
 */
export function salesTypeBadgeInitials(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] ?? trimmed;
  if (last.length <= 2) return last;
  return `${last[0] ?? ""}${last[last.length - 1] ?? ""}`;
}

/** Remove sales-type segment from customize subtitle (`Variant · Mod · SalesType`). */
export function stripSalesTypeFromSubServiceName(
  subServiceName: string | null | undefined,
  salesTypeName: string | null | undefined,
): string {
  const raw = (subServiceName ?? "").trim();
  if (!raw) return "";
  const label = (salesTypeName ?? "").trim().toLowerCase();
  if (!label) return raw;
  const parts = raw
    .split(/\s*·\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = parts.filter((p) => p.toLowerCase() !== label);
  return kept.join(" · ");
}
