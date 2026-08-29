import { supabase } from "@/shared/lib/supabaseClient";
import type { CheckoutCogsContext } from "./resolveCheckoutLineUnitCogs";

/** Load outlet stock + recipe/modifier BOM needed to snapshot line COGS at pay. */
export async function loadCheckoutCogsContext(args: {
  organizationId: string;
  outletId: string;
  productIds: string[];
  variantIds: string[];
  modifierOptionIds: string[];
}): Promise<CheckoutCogsContext> {
  const productIds = [...new Set(args.productIds.filter(Boolean))];
  const variantIds = [...new Set(args.variantIds.filter(Boolean))];
  const modifierOptionIds = [...new Set(args.modifierOptionIds.filter(Boolean))];

  const empty: CheckoutCogsContext = {
    productStockById: new Map(),
    variantStockById: new Map(),
    ingredientStockById: new Map(),
    recipeLines: [],
    modifierBomLines: [],
  };
  if (productIds.length === 0) return empty;

  const [productStockRes, variantStockRes, recipesRes, modBomRes] = await Promise.all([
    supabase
      .from("catalog_product_outlets")
      .select("product_id, track_cogs, avg_cost")
      .eq("organization_id", args.organizationId)
      .eq("outlet_id", args.outletId)
      .in("product_id", productIds),
    variantIds.length > 0
      ? supabase
          .from("catalog_product_variant_outlets")
          .select("variant_id, track_cogs, avg_cost")
          .eq("organization_id", args.organizationId)
          .eq("outlet_id", args.outletId)
          .in("variant_id", variantIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("catalog_product_recipes")
      .select("id, product_id, modifier_option_id")
      .eq("organization_id", args.organizationId)
      .in("product_id", productIds),
    modifierOptionIds.length > 0
      ? supabase
          .from("catalog_modifier_option_ingredients")
          .select("option_id, ingredient_id, quantity")
          .eq("organization_id", args.organizationId)
          .in("option_id", modifierOptionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productStockRes.error) throw productStockRes.error;
  if (variantStockRes.error) throw variantStockRes.error;
  if (recipesRes.error) throw recipesRes.error;
  if (modBomRes.error) throw modBomRes.error;

  const productStockById = new Map<string, { track_cogs: boolean; avg_cost: number }>();
  for (const row of productStockRes.data ?? []) {
    productStockById.set(String(row.product_id), {
      track_cogs: Boolean(row.track_cogs),
      avg_cost: Number(row.avg_cost) || 0,
    });
  }

  const variantStockById = new Map<string, { track_cogs: boolean; avg_cost: number }>();
  for (const row of variantStockRes.data ?? []) {
    variantStockById.set(String((row as { variant_id: string }).variant_id), {
      track_cogs: Boolean((row as { track_cogs?: boolean }).track_cogs),
      avg_cost: Number((row as { avg_cost?: number }).avg_cost) || 0,
    });
  }

  const recipes = (recipesRes.data ?? []) as Array<{
    id: string;
    product_id: string;
    modifier_option_id: string | null;
  }>;
  const recipeIds = recipes.map((r) => r.id);
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const recipeLines: CheckoutCogsContext["recipeLines"] = [];
  const ingredientIds = new Set<string>();

  if (recipeIds.length > 0) {
    const { data: lineRows, error: lineErr } = await supabase
      .from("catalog_product_recipe_lines")
      .select("recipe_id, ingredient_id, quantity")
      .in("recipe_id", recipeIds);
    if (lineErr) throw lineErr;
    for (const line of lineRows ?? []) {
      const recipe = recipeById.get(String(line.recipe_id));
      if (!recipe) continue;
      const ingredientId = String(line.ingredient_id);
      ingredientIds.add(ingredientId);
      recipeLines.push({
        product_id: recipe.product_id,
        modifier_option_id: recipe.modifier_option_id,
        ingredient_id: ingredientId,
        quantity: Number(line.quantity) || 0,
      });
    }
  }

  const modifierBomLines: CheckoutCogsContext["modifierBomLines"] = [];
  for (const row of modBomRes.data ?? []) {
    const ingredientId = String((row as { ingredient_id: string }).ingredient_id);
    ingredientIds.add(ingredientId);
    modifierBomLines.push({
      option_id: String((row as { option_id: string }).option_id),
      ingredient_id: ingredientId,
      quantity: Number((row as { quantity: number }).quantity) || 0,
    });
  }

  const ingredientStockById = new Map<string, { track_cogs: boolean; avg_cost: number }>();
  if (ingredientIds.size > 0) {
    const { data: ingStock, error: ingErr } = await supabase
      .from("catalog_ingredient_outlets")
      .select("ingredient_id, track_cogs, avg_cost")
      .eq("organization_id", args.organizationId)
      .eq("outlet_id", args.outletId)
      .in("ingredient_id", [...ingredientIds]);
    if (ingErr) throw ingErr;
    for (const row of ingStock ?? []) {
      ingredientStockById.set(String(row.ingredient_id), {
        track_cogs: Boolean(row.track_cogs),
        avg_cost: Number(row.avg_cost) || 0,
      });
    }
  }

  return {
    productStockById,
    variantStockById,
    ingredientStockById,
    recipeLines,
    modifierBomLines,
  };
}
