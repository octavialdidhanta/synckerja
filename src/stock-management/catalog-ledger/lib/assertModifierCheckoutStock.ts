export type ModifierCheckoutLine = {
  kind?: string | null;
  catalogId?: string | null;
  quantity: number;
  label?: string;
  modifiers?: Array<{ optionId: string }> | null;
};

export type ModifierOptionBomLine = {
  optionId: string;
  /** Set for product-specific fallback recipes; omitted for global option sheet BOM. */
  productId?: string | null;
  ingredientId: string;
  /** BOM qty per one selected option (multiplied by line.quantity). */
  quantityPerUnit: number;
  ingredientName?: string;
  /** When false, line is ignored (matches RPC stock_enabled gate). */
  stockEnabled: boolean;
};

export type InsufficientModifierStock = {
  optionId: string;
  productId: string;
  productLabel: string;
  ingredientId: string;
  ingredientName: string;
  needed: number;
  available: number;
};

function modifierBomMatchesLine(bom: ModifierOptionBomLine, productId: string, optionId: string): boolean {
  if (bom.optionId !== optionId || !bom.stockEnabled) return false;
  if (!bom.productId) return true;
  return bom.productId === productId;
}

/**
 * Aggregate modifier option BOM demand for cart lines and find the first shortfall.
 * Sheet BOM (no productId) applies to any product selecting the option; fallback recipes are product-scoped.
 */
export function findInsufficientModifierStock(args: {
  lines: ModifierCheckoutLine[];
  optionBomLines: ModifierOptionBomLine[];
  stockByIngredientId: Map<string, number>;
}): InsufficientModifierStock | null {
  const activeBoms = args.optionBomLines.filter(
    (row) => row.stockEnabled && row.quantityPerUnit > 0 && row.ingredientId && row.optionId,
  );
  if (activeBoms.length === 0) return null;

  const byIngredient = new Map<
    string,
    {
      needed: number;
      optionId: string;
      productId: string;
      productLabel: string;
      ingredientName: string;
    }
  >();

  for (const line of args.lines) {
    if (line.kind !== "product" || !line.catalogId || !(Number(line.quantity) > 0)) continue;
    const productId = String(line.catalogId);
    const label = line.label?.trim() || productId;
    const optionIds = (line.modifiers ?? [])
      .map((m) => m.optionId)
      .filter((id): id is string => Boolean(id));
    if (optionIds.length === 0) continue;

    for (const optionId of optionIds) {
      for (const row of activeBoms) {
        if (!modifierBomMatchesLine(row, productId, optionId)) continue;
        const needed = row.quantityPerUnit * Number(line.quantity);
        const prev = byIngredient.get(row.ingredientId);
        if (!prev) {
          byIngredient.set(row.ingredientId, {
            needed,
            optionId,
            productId,
            productLabel: label,
            ingredientName: row.ingredientName?.trim() || row.ingredientId,
          });
          continue;
        }
        byIngredient.set(row.ingredientId, {
          ...prev,
          needed: prev.needed + needed,
        });
      }
    }
  }

  for (const [ingredientId, row] of byIngredient) {
    const available = args.stockByIngredientId.get(ingredientId);
    const avail = Number.isFinite(available) ? Number(available) : 0;
    if (row.needed > avail) {
      return {
        optionId: row.optionId,
        productId: row.productId,
        productLabel: row.productLabel,
        ingredientId,
        ingredientName: row.ingredientName,
        needed: row.needed,
        available: avail,
      };
    }
  }
  return null;
}
