export type RecipeBomLineInput = {
  productId: string;
  ingredientId: string;
  quantityPerUnit: number;
  /** When false, line is ignored for availability. */
  trackInventory?: boolean;
  ingredientName?: string;
};

export type RecipeStockBlocker = {
  ingredientId: string;
  ingredientName: string;
  needed: number;
  available: number;
};

export type RecipeAvailability = {
  productId: string;
  /** null = no tracked recipe lines (do not gate). */
  maxServings: number | null;
  /** Ingredients that cannot cover 1 serving (available < needed). */
  blockers: RecipeStockBlocker[];
  /** Ingredient that sets maxServings (lowest floor(stock/qty)). */
  limiting: RecipeStockBlocker | null;
};

export const OUTLET_RECIPE_AVAILABILITY_QUERY_KEY = "outlet-recipe-availability";
