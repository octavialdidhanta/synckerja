import { supabase } from "@/shared/lib/supabaseClient";
import { buildRecipeAvailabilityMap } from "./computeRecipeAvailability";
import type { RecipeAvailability, RecipeBomLineInput } from "./types";

/**
 * Load base-recipe BOM + outlet ingredient stock → availability map.
 */
export async function fetchOutletRecipeAvailability(args: {
  organizationId: string;
  outletId: string;
}): Promise<Map<string, RecipeAvailability>> {
  const { organizationId, outletId } = args;

  const { data: recipes, error: recipeErr } = await supabase
    .from("catalog_product_recipes")
    .select("product_id, catalog_product_recipe_lines(ingredient_id, quantity)")
    .eq("organization_id", organizationId)
    .is("modifier_option_id", null);
  if (recipeErr) throw recipeErr;

  const bomLines: RecipeBomLineInput[] = [];
  const ingredientIds = new Set<string>();

  for (const recipe of recipes ?? []) {
    const productId = String(recipe.product_id ?? "");
    const lines =
      (
        recipe as {
          catalog_product_recipe_lines?: Array<{
            ingredient_id: string;
            quantity: number;
          }>;
        }
      ).catalog_product_recipe_lines ?? [];
    for (const line of lines) {
      const ingredientId = String(line.ingredient_id ?? "");
      const quantityPerUnit = Number(line.quantity) || 0;
      if (!productId || !ingredientId || !(quantityPerUnit > 0)) continue;
      bomLines.push({ productId, ingredientId, quantityPerUnit });
      ingredientIds.add(ingredientId);
    }
  }

  if (bomLines.length === 0) return new Map();

  const ids = [...ingredientIds];
  const { data: ingredients, error: ingErr } = await supabase
    .from("catalog_ingredients")
    .select(
      "id, name, track_inventory, catalog_ingredient_outlets(outlet_id, in_stock)",
    )
    .eq("organization_id", organizationId)
    .eq("is_deleted", false)
    .in("id", ids);
  if (ingErr) throw ingErr;

  const stockByIngredientId = new Map<string, number>();
  const trackById = new Map<string, boolean>();
  const nameById = new Map<string, string>();

  for (const row of ingredients ?? []) {
    const id = String(row.id);
    const track = Boolean(row.track_inventory);
    trackById.set(id, track);
    nameById.set(id, String((row as { name?: string }).name ?? "").trim() || id);
    if (!track) continue;
    const links =
      (
        row as {
          catalog_ingredient_outlets?: Array<{
            outlet_id: string;
            in_stock: number | string;
          }>;
        }
      ).catalog_ingredient_outlets ?? [];
    const stock = links.find((l) => l.outlet_id === outletId);
    const qty = Number(stock?.in_stock);
    stockByIngredientId.set(id, Number.isFinite(qty) && qty >= 0 ? qty : 0);
  }

  const trackedBom = bomLines.map((line) => ({
    ...line,
    trackInventory: trackById.get(line.ingredientId) ?? false,
    ingredientName: nameById.get(line.ingredientId),
  }));

  return buildRecipeAvailabilityMap(trackedBom, stockByIngredientId);
}
