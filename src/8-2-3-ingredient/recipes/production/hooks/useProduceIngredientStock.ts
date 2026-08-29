import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { applyCatalogIngredientProduce } from "@/stock-management/catalog-ledger/applyCatalogIngredientProduce";
import { invalidateCatalogStockCaches } from "../../../library/hooks/invalidateCatalogStockCaches";
import { CATALOG_INGREDIENT_RECIPES_QUERY_KEY } from "../../hooks/useCatalogIngredientRecipes";

export function useProduceIngredientStock() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      outletId: string;
      outputIngredientId: string;
      produceQty: number;
      activityId?: string;
    }) => {
      if (!organizationId) throw new Error("Organization ID is required");
      if (!args.outletId) throw new Error("Outlet ID is required");
      if (!(args.produceQty > 0)) throw new Error("Produce qty required");
      await applyCatalogIngredientProduce({
        organizationId,
        outletId: args.outletId,
        outputIngredientId: args.outputIngredientId,
        produceQty: args.produceQty,
        activityId: args.activityId ?? crypto.randomUUID(),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateCatalogStockCaches(queryClient, organizationId),
        queryClient.invalidateQueries({
          queryKey: [CATALOG_INGREDIENT_RECIPES_QUERY_KEY, organizationId],
        }),
      ]);
    },
  });
}
