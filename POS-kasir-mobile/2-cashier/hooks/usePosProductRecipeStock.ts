import { useOutletRecipeAvailability } from "@/stock-management/recipe-availability";

/**
 * Base product recipes (no modifier variant) + outlet ingredient stock →
 * OOS product IDs and blocker ingredient reasons.
 */
export function usePosProductRecipeStock(outletId: string | null | undefined) {
  const {
    recipeOutOfStockIds,
    recipeOutOfStockReasons,
    byProduct,
    isLoading,
  } = useOutletRecipeAvailability(outletId);

  return {
    recipeOutOfStockIds,
    recipeOutOfStockReasons,
    byProduct,
    isLoading,
  };
}
