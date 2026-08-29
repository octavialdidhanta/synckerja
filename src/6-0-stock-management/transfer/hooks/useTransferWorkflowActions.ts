import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateCatalogStockCaches } from "@/8-2-3-ingredient/library/hooks/invalidateCatalogStockCaches";
import { supabase } from "@/shared/lib/supabaseClient";
import { STOCK_TRANSFERS_QUERY_KEY } from "./useStockTransfersQuery";
import { STOCK_TRANSFER_DETAIL_QUERY_KEY } from "./useStockTransferDetailQuery";

const INVENTORY_ADJUSTABLE_PRODUCTS_QUERY_KEY = "inventory-adjustable-products";
const INVENTORY_ADJUSTABLE_INGREDIENTS_QUERY_KEY = "inventory-adjustable-ingredients";

async function invalidateTransferQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId?: string | null,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [STOCK_TRANSFERS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [STOCK_TRANSFER_DETAIL_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [INVENTORY_ADJUSTABLE_PRODUCTS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [INVENTORY_ADJUSTABLE_INGREDIENTS_QUERY_KEY] }),
    invalidateCatalogStockCaches(queryClient, organizationId),
  ]);
}

function useTransferWorkflowMutation(rpcName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { organizationId: string; transferId: string; comment?: string }) => {
      const { data, error } = await supabase.rpc(rpcName, {
        p_organization_id: args.organizationId,
        p_transfer_id: args.transferId,
        p_comment: args.comment ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, vars) => {
      await invalidateTransferQueries(queryClient, vars.organizationId);
    },
  });
}

export function useApproveStockTransfer() {
  return useTransferWorkflowMutation("approve_catalog_stock_transfer");
}

export function useShipStockTransfer() {
  return useTransferWorkflowMutation("ship_catalog_stock_transfer");
}

export function useFulfillStockTransfer() {
  return useTransferWorkflowMutation("fulfill_catalog_stock_transfer");
}

export function useCancelStockTransfer() {
  return useTransferWorkflowMutation("cancel_catalog_stock_transfer");
}
