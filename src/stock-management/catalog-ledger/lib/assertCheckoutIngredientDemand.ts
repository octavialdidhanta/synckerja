import type { ProductBaseRecipeLine, RecipeCheckoutLine } from "./assertRecipeCheckoutStock";
import type { ModifierCheckoutLine, ModifierOptionBomLine } from "./assertModifierCheckoutStock";

export type CheckoutIngredientAssertLine = RecipeCheckoutLine & ModifierCheckoutLine;

type IngredientDemandRow = {
  needed: number;
  ingredientName: string;
};

function aggregateBaseRecipeDemand(args: {
  lines: RecipeCheckoutLine[];
  recipeLines: ProductBaseRecipeLine[];
}): Map<string, IngredientDemandRow> {
  const demand = new Map<string, IngredientDemandRow>();
  const recipesByProduct = new Map<string, ProductBaseRecipeLine[]>();

  for (const row of args.recipeLines) {
    if (!(row.quantityPerUnit > 0) || !row.ingredientId) continue;
    const list = recipesByProduct.get(row.productId) ?? [];
    list.push(row);
    recipesByProduct.set(row.productId, list);
  }

  for (const line of args.lines) {
    if (line.kind !== "product" || !line.catalogId || !(Number(line.quantity) > 0)) continue;
    const productId = String(line.catalogId);
    const recipes = recipesByProduct.get(productId);
    if (!recipes?.length) continue;

    for (const recipe of recipes) {
      const needed = recipe.quantityPerUnit * Number(line.quantity);
      const prev = demand.get(recipe.ingredientId);
      demand.set(recipe.ingredientId, {
        needed: (prev?.needed ?? 0) + needed,
        ingredientName: recipe.ingredientName?.trim() || recipe.ingredientId,
      });
    }
  }

  return demand;
}

function aggregateModifierDemand(args: {
  lines: ModifierCheckoutLine[];
  optionBomLines: ModifierOptionBomLine[];
}): Map<string, IngredientDemandRow> {
  const demand = new Map<string, IngredientDemandRow>();
  const activeBoms = args.optionBomLines.filter(
    (row) => row.stockEnabled && row.quantityPerUnit > 0 && row.ingredientId && row.optionId,
  );

  for (const line of args.lines) {
    if (line.kind !== "product" || !line.catalogId || !(Number(line.quantity) > 0)) continue;
    const productId = String(line.catalogId);
    const optionIds = (line.modifiers ?? [])
      .map((m) => m.optionId)
      .filter((id): id is string => Boolean(id));

    for (const optionId of optionIds) {
      for (const bom of activeBoms) {
        if (bom.optionId !== optionId || !bom.stockEnabled) continue;
        if (bom.productId && bom.productId !== productId) continue;

        const needed = bom.quantityPerUnit * Number(line.quantity);
        const prev = demand.get(bom.ingredientId);
        demand.set(bom.ingredientId, {
          needed: (prev?.needed ?? 0) + needed,
          ingredientName: bom.ingredientName?.trim() || bom.ingredientId,
        });
      }
    }
  }

  return demand;
}

/**
 * Merge base recipe + modifier BOM demand and return the first ingredient shortfall.
 */
export function findInsufficientCheckoutIngredientStock(args: {
  lines: CheckoutIngredientAssertLine[];
  recipeLines: ProductBaseRecipeLine[];
  optionBomLines: ModifierOptionBomLine[];
  stockByIngredientId: Map<string, number>;
}): { ingredientId: string; ingredientName: string } | null {
  const combined = new Map<string, IngredientDemandRow>();

  for (const [ingredientId, row] of aggregateBaseRecipeDemand({
    lines: args.lines,
    recipeLines: args.recipeLines,
  })) {
    combined.set(ingredientId, { ...row });
  }

  for (const [ingredientId, row] of aggregateModifierDemand({
    lines: args.lines,
    optionBomLines: args.optionBomLines,
  })) {
    const prev = combined.get(ingredientId);
    if (!prev) {
      combined.set(ingredientId, { ...row });
      continue;
    }
    combined.set(ingredientId, {
      needed: prev.needed + row.needed,
      ingredientName: prev.ingredientName || row.ingredientName,
    });
  }

  for (const [ingredientId, row] of combined) {
    const available = args.stockByIngredientId.get(ingredientId);
    const avail = Number.isFinite(available) ? Number(available) : 0;
    if (row.needed > avail) {
      return { ingredientId, ingredientName: row.ingredientName };
    }
  }

  return null;
}
