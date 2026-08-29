export function buildItemSummaryText(names: string[], maxItems = 3): string {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return "—";
  const shown = trimmed.slice(0, maxItems);
  const suffix = trimmed.length > maxItems ? ` +${trimmed.length - maxItems}` : "";
  return `${shown.join(", ")}${suffix}`;
}
