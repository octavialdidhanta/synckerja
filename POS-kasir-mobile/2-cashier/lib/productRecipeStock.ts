/**
 * POS thin wrappers — shared math lives in `@/stock-management/recipe-availability`.
 */
export {
  buildRecipeOutOfStockProductIds,
  buildRecipeAvailabilityMap,
  analyzeRecipeServings,
  formatRecipeBlockerNames,
  OUTLET_RECIPE_AVAILABILITY_QUERY_KEY as POS_PRODUCT_RECIPE_STOCK_QUERY_KEY,
  type RecipeBomLineInput as ProductRecipeBomLine,
  type RecipeAvailability,
  type RecipeStockBlocker,
} from "@/stock-management/recipe-availability";
