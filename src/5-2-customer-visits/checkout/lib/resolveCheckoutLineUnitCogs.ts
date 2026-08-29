export type CheckoutCogsSource = "finished_goods" | "recipe_bom" | "estimated" | "none";

export type CheckoutCogsStockRow = {
  track_cogs: boolean;
  avg_cost: number;
};

export type CheckoutCogsRecipeLine = {
  product_id: string;
  modifier_option_id: string | null;
  ingredient_id: string;
  quantity: number;
};

export type CheckoutCogsModifierBomLine = {
  option_id: string;
  ingredient_id: string;
  quantity: number;
};

export type CheckoutCogsContext = {
  productStockById: Map<string, CheckoutCogsStockRow>;
  variantStockById: Map<string, CheckoutCogsStockRow>;
  ingredientStockById: Map<string, CheckoutCogsStockRow>;
  /** Base + variant recipes flattened to lines. */
  recipeLines: CheckoutCogsRecipeLine[];
  modifierBomLines: CheckoutCogsModifierBomLine[];
};

export type ResolveCheckoutLineUnitCogsInput = {
  productId: string | null | undefined;
  variantId?: string | null;
  modifierOptionIds?: string[] | null;
  ctx: CheckoutCogsContext;
};

export type ResolveCheckoutLineUnitCogsResult = {
  unitCogs: number | null;
  cogsSource: CheckoutCogsSource;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function bomCost(
  lines: Array<{ ingredient_id: string; quantity: number }>,
  ingredientStockById: Map<string, CheckoutCogsStockRow>,
): number {
  return lines.reduce((sum, line) => {
    const stock = ingredientStockById.get(line.ingredient_id);
    if (!stock?.track_cogs) return sum;
    return sum + Number(line.quantity) * Number(stock.avg_cost || 0);
  }, 0);
}

/**
 * Logic C: finished-goods avg_cost when track_cogs, else recipe/modifier BOM.
 * Pure helper — load context separately at checkout.
 */
export function resolveCheckoutLineUnitCogs(
  input: ResolveCheckoutLineUnitCogsInput,
): ResolveCheckoutLineUnitCogsResult {
  const productId = input.productId?.trim() || null;
  if (!productId) {
    return { unitCogs: null, cogsSource: "none" };
  }

  const variantId = input.variantId?.trim() || null;
  if (variantId) {
    const vStock = input.ctx.variantStockById.get(variantId);
    if (vStock?.track_cogs) {
      return { unitCogs: round2(Number(vStock.avg_cost) || 0), cogsSource: "finished_goods" };
    }
  }

  const pStock = input.ctx.productStockById.get(productId);
  if (pStock?.track_cogs) {
    return { unitCogs: round2(Number(pStock.avg_cost) || 0), cogsSource: "finished_goods" };
  }

  const baseLines = input.ctx.recipeLines.filter(
    (l) => l.product_id === productId && l.modifier_option_id == null,
  );
  let bom = bomCost(baseLines, input.ctx.ingredientStockById);

  const optionIds = [...new Set((input.modifierOptionIds ?? []).filter(Boolean))];
  for (const optionId of optionIds) {
    const modBom = input.ctx.modifierBomLines.filter((l) => l.option_id === optionId);
    if (modBom.length > 0) {
      bom += bomCost(modBom, input.ctx.ingredientStockById);
      continue;
    }
    const recipeMod = input.ctx.recipeLines.filter(
      (l) => l.product_id === productId && l.modifier_option_id === optionId,
    );
    bom += bomCost(recipeMod, input.ctx.ingredientStockById);
  }

  if (bom > 0 || baseLines.length > 0 || optionIds.length > 0) {
    if (bom > 0) return { unitCogs: round2(bom), cogsSource: "recipe_bom" };
  }

  return { unitCogs: null, cogsSource: "none" };
}
