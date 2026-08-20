import { ingredientStockStatus } from "../../library/lib/ingredientStockStatus";
import type { CatalogIngredient } from "../../library/types";
import type {
  CatalogProductRecipe,
  ProductRecipeTargetProduct,
  ProductRecipeVariantOption,
} from "../types";

export type ProductRecipeListRow = {
  recipeId: string;
  productId: string;
  productName: string;
  modifierOptionId: string | null;
  variantLabel: string;
  lineCount: number;
  stockAlert: "out" | "low" | "";
};

export function recipeVariantLabel(
  modifierOptionId: string | null,
  options: ProductRecipeVariantOption[],
): string {
  if (!modifierOptionId) return "";
  const option = options.find((row) => row.id === modifierOptionId);
  if (!option) return "";
  return option.group_name ? `${option.group_name}: ${option.name}` : option.name;
}

export function recipeStockAlert(
  recipe: CatalogProductRecipe,
  ingredientsById: Map<string, CatalogIngredient>,
  outletId: string,
): "out" | "low" | "" {
  let worst: "out" | "low" | "" = "";
  for (const line of recipe.lines) {
    const ingredient = ingredientsById.get(line.ingredient_id);
    if (!ingredient) continue;
    const status = ingredientStockStatus(ingredient, outletId);
    if (status === "out") return "out";
    if (status === "low") worst = "low";
  }
  return worst;
}

export function buildProductRecipeListRows(args: {
  recipes: CatalogProductRecipe[];
  products: ProductRecipeTargetProduct[];
  modifierOptions: ProductRecipeVariantOption[];
  ingredients: CatalogIngredient[];
  outletId: string;
}): ProductRecipeListRow[] {
  if (!args.outletId) return [];
  const productsById = new Map(args.products.map((row) => [row.id, row]));
  const ingredientsById = new Map(args.ingredients.map((row) => [row.id, row]));

  return args.recipes
    .map((recipe) => {
      const product = productsById.get(recipe.product_id);
      if (!product || !(product.outlet_ids ?? []).includes(args.outletId)) return null;
      return {
        recipeId: recipe.id,
        productId: recipe.product_id,
        productName: product.name,
        modifierOptionId: recipe.modifier_option_id,
        variantLabel: recipeVariantLabel(recipe.modifier_option_id, args.modifierOptions),
        lineCount: recipe.lines.length,
        stockAlert: recipeStockAlert(recipe, ingredientsById, args.outletId),
      };
    })
    .filter((row): row is ProductRecipeListRow => row != null)
    .sort((a, b) => {
      const nameCmp = a.productName.localeCompare(b.productName);
      if (nameCmp !== 0) return nameCmp;
      return a.variantLabel.localeCompare(b.variantLabel);
    });
}
