export type RecipeCheckoutLine = {
  kind?: string | null;
  catalogId?: string | null;
  quantity: number;
  label?: string;
};

export type ProductBaseRecipeLine = {
  productId: string;
  ingredientId: string;
  quantityPerUnit: number;
  ingredientName?: string;
};

export type InsufficientRecipeStock = {
  productId: string;
  productLabel: string;
  ingredientId: string;
  ingredientName: string;
  needed: number;
  available: number;
};

/**
 * Aggregate recipe ingredient demand for cart lines and find the first shortfall.
 * Only considers lines with kind=product and a catalogId.
 */
export function findInsufficientRecipeStock(args: {
  lines: RecipeCheckoutLine[];
  recipeLines: ProductBaseRecipeLine[];
  stockByIngredientId: Map<string, number>;
}): InsufficientRecipeStock | null {
  const demand = new Map<
    string,
    { needed: number; productId: string; productLabel: string; ingredientName: string }
  >();

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
    const label = line.label?.trim() || productId;
    for (const recipe of recipes) {
      const needed = recipe.quantityPerUnit * Number(line.quantity);
      const key = `${productId}:${recipe.ingredientId}`;
      const prev = demand.get(key);
      demand.set(key, {
        needed: (prev?.needed ?? 0) + needed,
        productId,
        productLabel: label,
        ingredientName: recipe.ingredientName?.trim() || recipe.ingredientId,
      });
    }
  }

  // Sum demand across products that share the same ingredient (outlet pool)
  const byIngredient = new Map<
    string,
    { needed: number; productId: string; productLabel: string; ingredientName: string }
  >();
  for (const [key, row] of demand) {
    const ingredientId = key.slice(key.indexOf(":") + 1);
    const prev = byIngredient.get(ingredientId);
    if (!prev) {
      byIngredient.set(ingredientId, { ...row });
      continue;
    }
    byIngredient.set(ingredientId, {
      ...prev,
      needed: prev.needed + row.needed,
    });
  }

  for (const [ingredientId, row] of byIngredient) {
    const available = args.stockByIngredientId.get(ingredientId);
    const avail = Number.isFinite(available) ? Number(available) : 0;
    if (row.needed > avail) {
      return {
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
