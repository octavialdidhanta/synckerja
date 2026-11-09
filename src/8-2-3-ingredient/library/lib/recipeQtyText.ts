/**
 * Parse a recipe quantity as typed: accepts "0,15", "0.15", "1.", ",5". Returns null for empty or
 * unreadable text. Negative numbers are not possible (the minus sign is not accepted).
 */
export function parseRecipeQtyText(raw: string): number | null {
  const text = raw.replace(/\s+/g, "").replace(",", ".");
  if (!text || text === ".") return null;
  if (!/^\d*\.?\d*$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
