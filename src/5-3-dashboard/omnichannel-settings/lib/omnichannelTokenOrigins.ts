/** Parse comma- or newline-separated origins (matches create-token dialog). */
export function parseOriginsFromText(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((o) => o.trim())
    .filter(Boolean);
}

export function originsListsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const norm = (list: string[]) =>
    [...list].map((o) => o.trim().toLowerCase()).sort((x, y) => x.localeCompare(y));
  const na = norm(a);
  const nb = norm(b);
  return na.every((v, i) => v === nb[i]);
}

/** Compact display for token table: first items + count of remainder. */
export function formatOriginsPreview(origins: string[], maxShown = 2): string {
  const list = origins.map((o) => o.trim()).filter(Boolean);
  if (list.length === 0) return "—";
  const shown = list.slice(0, maxShown);
  const rest = list.length - shown.length;
  const base = shown.join(", ");
  return rest > 0 ? `${base} +${rest}` : base;
}
