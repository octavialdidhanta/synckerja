import type { CatalogIngredient } from "../../library/types";
import type { ProductRecipeTargetProduct, ProductRecipeVariantOption } from "../types";

export function productsForOutlet(
  products: ProductRecipeTargetProduct[],
  outletId: string,
): ProductRecipeTargetProduct[] {
  if (!outletId) return [];
  return products.filter((row) => (row.outlet_ids ?? []).includes(outletId));
}

export function ingredientsForOutlet(
  ingredients: CatalogIngredient[],
  outletId: string,
): CatalogIngredient[] {
  if (!outletId) return [];
  return ingredients.filter((row) => {
    if (row.kind !== "raw" && row.kind !== "semi_finished") return false;
    return (row.outlet_ids ?? []).includes(outletId);
  });
}

export function variantOptionsForProduct(
  productId: string,
  links: Array<{ product_id: string; group_id: string; group_name: string }>,
  options: Array<{ id: string; group_id: string; name: string; is_active: boolean }>,
): ProductRecipeVariantOption[] {
  const groupIds = new Set(
    links.filter((link) => link.product_id === productId).map((link) => link.group_id),
  );
  const groupNameById = new Map(
    links.filter((link) => link.product_id === productId).map((link) => [link.group_id, link.group_name]),
  );
  return options
    .filter((option) => option.is_active && groupIds.has(option.group_id))
    .map((option) => ({
      id: option.id,
      group_id: option.group_id,
      group_name: groupNameById.get(option.group_id) ?? "",
      name: option.name,
    }))
    .sort((a, b) => {
      const groupCmp = a.group_name.localeCompare(b.group_name);
      if (groupCmp !== 0) return groupCmp;
      return a.name.localeCompare(b.name);
    });
}

export function productHasAnyRecipe(
  productId: string,
  recipeProductIds: Set<string>,
): boolean {
  return recipeProductIds.has(productId);
}
