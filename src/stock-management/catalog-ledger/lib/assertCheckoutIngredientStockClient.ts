import { supabase } from "@/shared/lib/supabaseClient";
import type { ProductBaseRecipeLine } from "./assertRecipeCheckoutStock";
import type { FallbackRecipeRow, SheetBomRow } from "./buildCheckoutModifierBomLines";
import {
  buildCheckoutModifierBomLines,
  buildSheetModifierBomLines,
} from "./buildCheckoutModifierBomLines";
import {
  findInsufficientCheckoutIngredientStock,
  type CheckoutIngredientAssertLine,
} from "./assertCheckoutIngredientDemand";
import {
  CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK,
  CheckoutStockError,
} from "./checkoutStockErrors";

export type { CheckoutIngredientAssertLine };

/**
 * Pre-pay assert: base product recipes + stock_enabled modifier option BOMs
 * (with product-recipe fallback when option has no BOM rows).
 */
export async function assertCheckoutIngredientStock(args: {
  outletId: string;
  lines: CheckoutIngredientAssertLine[];
}): Promise<{ ingredientId: string; ingredientName: string } | null> {
  const productLines = args.lines.filter(
    (l) => l.kind === "product" && l.catalogId && Number(l.quantity) > 0,
  );
  if (productLines.length === 0) return null;

  const productIds = [...new Set(productLines.map((l) => String(l.catalogId)))];
  const selectedOptionIds = [
    ...new Set(
      productLines.flatMap((l) =>
        (l.modifiers ?? []).map((m) => m.optionId).filter((id): id is string => Boolean(id)),
      ),
    ),
  ];

  const { data: recipes, error: recipeErr } = await supabase
    .from("catalog_product_recipes")
    .select("id, product_id, catalog_product_recipe_lines(ingredient_id, quantity)")
    .in("product_id", productIds)
    .is("modifier_option_id", null);
  if (recipeErr) throw recipeErr;

  const baseRaw: Array<{ productId: string; ingredientId: string; quantityPerUnit: number }> = [];
  const ingredientIds = new Set<string>();

  for (const recipe of recipes ?? []) {
    const productId = String(recipe.product_id);
    const lines =
      (
        recipe as {
          catalog_product_recipe_lines?: Array<{ ingredient_id: string; quantity: number }>;
        }
      ).catalog_product_recipe_lines ?? [];
    for (const line of lines) {
      const ingredientId = String(line.ingredient_id);
      const quantityPerUnit = Number(line.quantity) || 0;
      if (!ingredientId || !(quantityPerUnit > 0)) continue;
      baseRaw.push({ productId, ingredientId, quantityPerUnit });
      ingredientIds.add(ingredientId);
    }
  }

  let optionBomRaw: Array<{
    optionId: string;
    productId?: string;
    ingredientId: string;
    quantityPerUnit: number;
    stockEnabled: boolean;
  }> = [];

  if (selectedOptionIds.length > 0) {
    const { data: optionRows, error: optErr } = await supabase
      .from("catalog_modifier_options")
      .select("id, catalog_modifier_groups!inner(stock_enabled)")
      .in("id", selectedOptionIds);
    if (optErr) throw optErr;

    const stockEnabledOptionIds = new Set<string>();
    for (const row of optionRows ?? []) {
      const group = (
        row as {
          catalog_modifier_groups?: { stock_enabled?: boolean } | { stock_enabled?: boolean }[];
        }
      ).catalog_modifier_groups;
      const g = Array.isArray(group) ? group[0] : group;
      if (g?.stock_enabled === true) stockEnabledOptionIds.add(String(row.id));
    }

    const enabledIds = [...stockEnabledOptionIds];
    if (enabledIds.length > 0) {
      const { data: optionBoms, error: bomErr } = await supabase
        .from("catalog_modifier_option_ingredients")
        .select("option_id, ingredient_id, quantity")
        .in("option_id", enabledIds);
      if (bomErr) throw bomErr;

      const sheetBomRows: SheetBomRow[] = [];
      for (const row of optionBoms ?? []) {
        const optionId = String(row.option_id);
        const ingredientId = String(row.ingredient_id);
        const quantityPerUnit = Number(row.quantity) || 0;
        if (!optionId || !ingredientId || !(quantityPerUnit > 0)) continue;
        sheetBomRows.push({ optionId, ingredientId, quantityPerUnit });
        ingredientIds.add(ingredientId);
      }

      const { sheetBomOptionIds } = buildSheetModifierBomLines(sheetBomRows);
      const fallbackOptionIds = enabledIds.filter((id) => !sheetBomOptionIds.has(id));

      const fallbackRecipes: FallbackRecipeRow[] = [];
      if (fallbackOptionIds.length > 0) {
        const { data: modRecipes, error: modRecipeErr } = await supabase
          .from("catalog_product_recipes")
          .select(
            "product_id, modifier_option_id, catalog_product_recipe_lines(ingredient_id, quantity)",
          )
          .in("product_id", productIds)
          .in("modifier_option_id", fallbackOptionIds);
        if (modRecipeErr) throw modRecipeErr;

        for (const recipe of modRecipes ?? []) {
          const optionId = recipe.modifier_option_id
            ? String(recipe.modifier_option_id)
            : null;
          if (!optionId) continue;

          const lines =
            (
              recipe as {
                catalog_product_recipe_lines?: Array<{
                  ingredient_id: string;
                  quantity: number;
                }>;
              }
            ).catalog_product_recipe_lines ?? [];

          const recipeLines = lines
            .map((line) => ({
              ingredientId: String(line.ingredient_id),
              quantityPerUnit: Number(line.quantity) || 0,
            }))
            .filter((line) => line.ingredientId && line.quantityPerUnit > 0);

          if (recipeLines.length === 0) continue;

          fallbackRecipes.push({
            productId: String(recipe.product_id),
            optionId,
            lines: recipeLines,
          });

          for (const line of recipeLines) {
            ingredientIds.add(line.ingredientId);
          }
        }
      }

      const built = buildCheckoutModifierBomLines({
        sheetBoms: sheetBomRows,
        fallbackRecipes,
      });
      optionBomRaw = built.optionBomLines;
    }
  }

  if (baseRaw.length === 0 && optionBomRaw.length === 0) return null;

  const ids = [...ingredientIds];
  const [{ data: ingredients, error: ingErr }, { data: outletStock, error: stockErr }] =
    await Promise.all([
      supabase
        .from("catalog_ingredients")
        .select("id, name, track_inventory, is_deleted")
        .in("id", ids),
      supabase
        .from("catalog_ingredient_outlets")
        .select("ingredient_id, in_stock")
        .eq("outlet_id", args.outletId)
        .in("ingredient_id", ids),
    ]);
  if (ingErr) throw ingErr;
  if (stockErr) throw stockErr;

  const trackable = new Map<string, string>();
  for (const row of ingredients ?? []) {
    if (row.track_inventory === true && row.is_deleted !== true) {
      trackable.set(String(row.id), String(row.name ?? ""));
    }
  }

  const recipeLines: ProductBaseRecipeLine[] = baseRaw
    .filter((row) => trackable.has(row.ingredientId))
    .map((row) => ({
      ...row,
      ingredientName: trackable.get(row.ingredientId) ?? row.ingredientId,
    }));

  const optionBomLines = optionBomRaw
    .filter((row) => trackable.has(row.ingredientId))
    .map((row) => ({
      ...row,
      ingredientName: trackable.get(row.ingredientId) ?? row.ingredientId,
    }));

  if (recipeLines.length === 0 && optionBomLines.length === 0) return null;

  const stockByIngredientId = new Map<string, number>();
  for (const id of trackable.keys()) stockByIngredientId.set(id, 0);
  for (const row of outletStock ?? []) {
    const id = String(row.ingredient_id);
    if (!trackable.has(id)) continue;
    stockByIngredientId.set(id, Number(row.in_stock) || 0);
  }

  return findInsufficientCheckoutIngredientStock({
    lines: args.lines,
    recipeLines,
    optionBomLines,
    stockByIngredientId,
  });
}

export async function assertCheckoutIngredientStockOrThrow(args: {
  outletId: string;
  lines: CheckoutIngredientAssertLine[];
}): Promise<void> {
  const insufficient = await assertCheckoutIngredientStock(args);
  if (!insufficient) return;
  throw new CheckoutStockError(
    CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK,
    insufficient.ingredientName,
  );
}
