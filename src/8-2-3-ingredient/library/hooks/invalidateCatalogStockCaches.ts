import type { QueryClient } from "@tanstack/react-query";
import { CATALOG_INGREDIENTS_QUERY_KEY } from "./catalogIngredientsQueryKey";

/** Refetch Ingredient Library + mark Inventory Summary / POS recipe OOS / customize stale after stock writes. */
export function invalidateCatalogStockCaches(
  queryClient: QueryClient,
  organizationId: string | null | undefined,
): Promise<void> {
  if (!organizationId) return Promise.resolve();
  return Promise.all([
    queryClient.refetchQueries({ queryKey: [CATALOG_INGREDIENTS_QUERY_KEY, organizationId] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["outlet-recipe-availability"] }),
    queryClient.invalidateQueries({ queryKey: ["pos-product-recipe-stock"] }),
    queryClient.invalidateQueries({ queryKey: ["pos-item-customize-options"] }),
  ]).then(() => undefined);
}
