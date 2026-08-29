import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateCatalogStockCaches } from "@/8-2-3-ingredient/library/hooks/invalidateCatalogStockCaches";
import { supabase } from "@/shared/lib/supabaseClient";
import type { TransferKindFilter, StockTransferLineDraft } from "../types";
import { STOCK_TRANSFERS_QUERY_KEY } from "./useStockTransfersQuery";
import { STOCK_TRANSFER_DETAIL_QUERY_KEY } from "./useStockTransferDetailQuery";

const INVENTORY_ADJUSTABLE_PRODUCTS_QUERY_KEY = "inventory-adjustable-products";
const INVENTORY_ADJUSTABLE_INGREDIENTS_QUERY_KEY = "inventory-adjustable-ingredients";

function kindToDb(kind: TransferKindFilter): "product" | "ingredient" {
  return kind === "item_library" ? "product" : "ingredient";
}

export function useCreateStockTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      organizationId: string;
      fromOutletId: string;
      toOutletId: string;
      kind: TransferKindFilter;
      note: string;
      lines: StockTransferLineDraft[];
    }) => {
      const lines = args.lines
        .filter((line) => line.qty > 0)
        .map((line) => ({
          product_id: args.kind === "item_library" ? line.productId ?? null : null,
          variant_id: args.kind === "item_library" ? line.variantId ?? null : null,
          ingredient_id: args.kind === "ingredients" ? line.ingredientId ?? null : null,
          qty: line.qty,
          name_snapshot: line.nameSnapshot,
          unit_snapshot: line.unitSnapshot ?? null,
        }));

      const { data, error } = await supabase.rpc("create_catalog_stock_transfer", {
        p_organization_id: args.organizationId,
        p_from_outlet_id: args.fromOutletId,
        p_to_outlet_id: args.toOutletId,
        p_item_kind: kindToDb(args.kind),
        p_note: args.note,
        p_lines: lines,
      });
      if (error) throw error;
      return data as { id: string; order_number: string };
    },
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [STOCK_TRANSFERS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [STOCK_TRANSFER_DETAIL_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [INVENTORY_ADJUSTABLE_PRODUCTS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [INVENTORY_ADJUSTABLE_INGREDIENTS_QUERY_KEY] }),
        invalidateCatalogStockCaches(queryClient, vars.organizationId),
      ]);
    },
  });
}
