export type RecipeLineDraft = {
  ingredient_id: string;
  quantity: number;
};

export type RecipeDraft = {
  yieldQty: number;
  lines: RecipeLineDraft[];
};

export type CatalogIngredientRecipeLine = RecipeLineDraft & {
  sort_order: number;
};

export type CatalogIngredientRecipe = {
  id: string;
  organization_id: string;
  output_ingredient_id: string;
  yield_qty: number;
  lines: CatalogIngredientRecipeLine[];
};

export type CatalogIngredientRecipeSave = {
  outputIngredientId: string;
  yieldQty: number;
  lines: RecipeLineDraft[];
};

export function emptyRecipeDraft(): RecipeDraft {
  return { yieldQty: 0, lines: [] };
}
