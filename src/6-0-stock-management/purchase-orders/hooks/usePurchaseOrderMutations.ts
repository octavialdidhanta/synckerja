import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PurchaseOrderLineDraft, PurchaseOrderKindFilter } from "../types";
import { PURCHASE_ORDERS_QUERY_KEY } from "./usePurchaseOrdersQuery";
import { PURCHASE_ORDER_DETAIL_QUERY_KEY } from "./usePurchaseOrderDetailQuery";

const INVENTORY_ADJUSTABLE_PRODUCTS_QUERY_KEY = "inventory-adjustable-products";
const INVENTORY_ADJUSTABLE_INGREDIENTS_QUERY_KEY = "inventory-adjustable-ingredients";

function kindToDb(kind: PurchaseOrderKindFilter): "product" | "ingredient" {
  return kind === "item_library" ? "product" : "ingredient";
}

function toRpcLines(kind: PurchaseOrderKindFilter, lines: PurchaseOrderLineDraft[]) {
  return lines
    .filter((line) => line.qty > 0)
    .map((line) => ({
      product_id: kind === "item_library" ? line.productId ?? null : null,
      variant_id: kind === "item_library" ? line.variantId ?? null : null,
      ingredient_id: kind === "ingredients" ? line.ingredientId ?? null : null,
      qty: line.qty,
      unit_cost: line.unitCost,
      name_snapshot: line.nameSnapshot,
    }));
}

async function invalidatePoQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDER_DETAIL_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
    queryClient.invalidateQueries({ queryKey: [INVENTORY_ADJUSTABLE_PRODUCTS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [INVENTORY_ADJUSTABLE_INGREDIENTS_QUERY_KEY] }),
  ]);
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      organizationId: string;
      outletId: string;
      supplierId: string | null;
      kind: PurchaseOrderKindFilter;
      note: string;
      lines: PurchaseOrderLineDraft[];
      createAndFulfill: boolean;
    }) => {
      const { data, error } = await supabase.rpc("create_catalog_purchase_order", {
        p_organization_id: args.organizationId,
        p_outlet_id: args.outletId,
        p_supplier_id: args.supplierId,
        p_item_kind: kindToDb(args.kind),
        p_note: args.note,
        p_lines: toRpcLines(args.kind, args.lines),
        p_create_and_fulfill: args.createAndFulfill,
      });
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: async () => {
      await invalidatePoQueries(queryClient);
    },
  });
}

export function useFulfillPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { organizationId: string; purchaseOrderId: string; comment?: string }) => {
      const { data, error } = await supabase.rpc("fulfill_catalog_purchase_order", {
        p_organization_id: args.organizationId,
        p_purchase_order_id: args.purchaseOrderId,
        p_comment: args.comment ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidatePoQueries(queryClient);
    },
  });
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { organizationId: string; purchaseOrderId: string; comment?: string }) => {
      const { data, error } = await supabase.rpc("cancel_catalog_purchase_order", {
        p_organization_id: args.organizationId,
        p_purchase_order_id: args.purchaseOrderId,
        p_comment: args.comment ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidatePoQueries(queryClient);
    },
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      organizationId: string;
      purchaseOrderId: string;
      kind: PurchaseOrderKindFilter;
      note: string;
      lines: PurchaseOrderLineDraft[];
    }) => {
      const { data, error } = await supabase.rpc("update_catalog_purchase_order", {
        p_organization_id: args.organizationId,
        p_purchase_order_id: args.purchaseOrderId,
        p_note: args.note,
        p_lines: toRpcLines(args.kind, args.lines),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidatePoQueries(queryClient);
    },
  });
}
