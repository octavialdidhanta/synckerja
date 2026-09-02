import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  orphanOrderPublishOutletIds,
  planOrderCatalogPublish,
} from "@/synckerja-order/shared/lib/orderCatalogPublish";
import { SYNCKERJA_ORDER_CATALOG_QUERY } from "./useSynckerjaOrderCatalog";

export const PRODUCT_ORDER_PUBLISH_QUERY = "synckerja-order-product-publish";

export function useProductOrderPublish(productId: string | null, outletId: string | null) {
  const query = useQuery({
    queryKey: [PRODUCT_ORDER_PUBLISH_QUERY, productId, outletId],
    queryFn: async (): Promise<boolean> => {
      if (!productId || !outletId) return false;
      const { data, error } = await supabase
        .from("synckerja_order_catalog_items")
        .select("catalog_item_id")
        .eq("catalog_item_id", productId)
        .eq("outlet_id", outletId)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    enabled: Boolean(productId && outletId),
  });

  return { ...query, optedIn: query.data === true };
}

export async function syncProductOrderPublish(args: {
  organizationId: string;
  productId: string;
  selectedOutletId: string | null | undefined;
  assignedOutletIds: string[];
  wantPublish: boolean;
}): Promise<void> {
  const assignedOutletIds = [...new Set(args.assignedOutletIds.filter(Boolean))];
  const { data: existing, error: existingError } = await supabase
    .from("synckerja_order_catalog_items")
    .select("outlet_id")
    .eq("catalog_item_id", args.productId);
  if (existingError) throw existingError;

  const optedInOutletIds = (existing ?? []).map((row) => String(row.outlet_id));
  const orphans = orphanOrderPublishOutletIds({ optedInOutletIds, assignedOutletIds });
  if (orphans.length > 0) {
    const { error } = await supabase
      .from("synckerja_order_catalog_items")
      .delete()
      .eq("catalog_item_id", args.productId)
      .in("outlet_id", orphans);
    if (error) throw error;
  }

  const selectedOutletId = (args.selectedOutletId ?? "").trim();
  if (!selectedOutletId) return;

  const currentlyOptedIn =
    optedInOutletIds.includes(selectedOutletId) && !orphans.includes(selectedOutletId);
  const plan = planOrderCatalogPublish({
    assigned: assignedOutletIds.includes(selectedOutletId),
    wantPublish: args.wantPublish,
    currentlyOptedIn,
  });

  if (plan === "insert") {
    const { error } = await supabase.from("synckerja_order_catalog_items").insert({
      organization_id: args.organizationId,
      outlet_id: selectedOutletId,
      catalog_item_id: args.productId,
    });
    if (error && !/duplicate/i.test(error.message)) throw error;
    return;
  }

  if (plan === "delete") {
    const { error } = await supabase
      .from("synckerja_order_catalog_items")
      .delete()
      .eq("catalog_item_id", args.productId)
      .eq("outlet_id", selectedOutletId);
    if (error) throw error;
  }
}

export function invalidateOrderCatalogQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string | null | undefined,
) {
  void queryClient.invalidateQueries({ queryKey: [SYNCKERJA_ORDER_CATALOG_QUERY, organizationId] });
  void queryClient.invalidateQueries({ queryKey: [PRODUCT_ORDER_PUBLISH_QUERY] });
}
