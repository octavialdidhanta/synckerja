import type { ModifierOptionBomLine } from "./assertModifierCheckoutStock";

export type SheetBomRow = {
  optionId: string;
  ingredientId: string;
  quantityPerUnit: number;
};

export type FallbackRecipeRow = {
  productId: string;
  optionId: string;
  lines: Array<{ ingredientId: string; quantityPerUnit: number }>;
};

/**
 * Build option sheet BOM lines. sheetBomOptionIds mirrors RPC v_option_mapped:
 * when an option has sheet BOM rows, product-recipe fallback is skipped entirely.
 */
export function buildSheetModifierBomLines(sheetBoms: SheetBomRow[]): {
  optionBomLines: ModifierOptionBomLine[];
  sheetBomOptionIds: Set<string>;
} {
  const optionBomLines: ModifierOptionBomLine[] = [];
  const sheetBomOptionIds = new Set<string>();

  for (const row of sheetBoms) {
    const optionId = String(row.optionId);
    const ingredientId = String(row.ingredientId);
    const quantityPerUnit = Number(row.quantityPerUnit) || 0;
    if (!optionId || !ingredientId || !(quantityPerUnit > 0)) continue;

    sheetBomOptionIds.add(optionId);
    optionBomLines.push({
      optionId,
      ingredientId,
      quantityPerUnit,
      stockEnabled: true,
    });
  }

  return { optionBomLines, sheetBomOptionIds };
}

/**
 * Build product-scoped fallback modifier recipe BOM lines.
 * Skips options that already have sheet BOM (sheetBomOptionIds); never mutates that set.
 */
export function buildFallbackModifierBomLines(
  fallbackRecipes: FallbackRecipeRow[],
  sheetBomOptionIds: Set<string>,
): ModifierOptionBomLine[] {
  const optionBomLines: ModifierOptionBomLine[] = [];

  for (const recipe of fallbackRecipes) {
    const optionId = String(recipe.optionId);
    const productId = String(recipe.productId);
    if (!optionId || !productId || sheetBomOptionIds.has(optionId)) continue;

    for (const line of recipe.lines) {
      const ingredientId = String(line.ingredientId);
      const quantityPerUnit = Number(line.quantityPerUnit) || 0;
      if (!ingredientId || !(quantityPerUnit > 0)) continue;

      optionBomLines.push({
        optionId,
        productId,
        ingredientId,
        quantityPerUnit,
        stockEnabled: true,
      });
    }
  }

  return optionBomLines;
}

export function buildCheckoutModifierBomLines(args: {
  sheetBoms: SheetBomRow[];
  fallbackRecipes: FallbackRecipeRow[];
}): {
  optionBomLines: ModifierOptionBomLine[];
  sheetBomOptionIds: Set<string>;
} {
  const { optionBomLines: sheetLines, sheetBomOptionIds } = buildSheetModifierBomLines(
    args.sheetBoms,
  );
  const fallbackLines = buildFallbackModifierBomLines(args.fallbackRecipes, sheetBomOptionIds);
  return {
    optionBomLines: [...sheetLines, ...fallbackLines],
    sheetBomOptionIds,
  };
}
