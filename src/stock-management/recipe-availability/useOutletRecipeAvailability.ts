import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useCatalogIngredientStockRealtime } from "@/8-2-3-ingredient/library/hooks/useCatalogIngredientStockRealtime";
import { fetchOutletRecipeAvailability } from "./fetchOutletRecipeAvailability";
import { OUTLET_RECIPE_AVAILABILITY_QUERY_KEY } from "./types";
import type { RecipeAvailability, RecipeStockBlocker } from "./types";

export function useOutletRecipeAvailability(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  useCatalogIngredientStockRealtime(organizationId, "recipe-availability");

  const query = useQuery({
    queryKey: [OUTLET_RECIPE_AVAILABILITY_QUERY_KEY, organizationId, outletId],
    enabled: Boolean(organizationId && outletId),
    queryFn: async (): Promise<Map<string, RecipeAvailability>> => {
      if (!organizationId || !outletId) return new Map();
      return fetchOutletRecipeAvailability({ organizationId, outletId });
    },
  });

  const byProduct = query.data ?? new Map<string, RecipeAvailability>();

  const recipeOutOfStockIds = new Set<string>();
  const recipeOutOfStockReasons = new Map<string, RecipeStockBlocker[]>();

  for (const [productId, avail] of byProduct) {
    if (avail.maxServings != null && avail.maxServings <= 0) {
      recipeOutOfStockIds.add(productId);
      recipeOutOfStockReasons.set(productId, avail.blockers);
    }
  }

  return {
    byProduct,
    recipeOutOfStockIds,
    recipeOutOfStockReasons,
    isLoading: query.isLoading,
  };
}
