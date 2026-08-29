export type ModifierStockOptionDraft = {
  key: string;
  optionName: string;
  ingredientId: string | null;
  quantityDisplay: string;
};

export function parseModifierStockQty(raw: string): number | null {
  const n = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** When stock is enabled, every named option must have ingredient + qty > 0. */
export function validateModifierStockDrafts(
  stockEnabled: boolean,
  drafts: ModifierStockOptionDraft[],
): { ok: true } | { ok: false; missingKeys: string[] } {
  if (!stockEnabled) return { ok: true };
  const missingKeys: string[] = [];
  for (const row of drafts) {
    if (!row.optionName.trim()) continue;
    const qty = parseModifierStockQty(row.quantityDisplay);
    if (!row.ingredientId || qty == null) missingKeys.push(row.key);
  }
  if (missingKeys.length > 0) return { ok: false, missingKeys };
  return { ok: true };
}
