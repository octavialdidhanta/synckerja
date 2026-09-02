import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  DEFAULT_CATEGORY_LAYOUT,
  parseCategoryLayout,
  type CategoryLayout,
} from "@/synckerja-order/shared/lib/orderCategoryLayout";

export const SYNCKERJA_ORDER_CATEGORY_LAYOUTS_QUERY = "synckerja-order-category-layouts";

export type SynckerjaOrderCategoryLayoutRow = {
  category_id: string;
  layout: CategoryLayout;
};

export function useSynckerjaOrderCategoryLayouts(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [SYNCKERJA_ORDER_CATEGORY_LAYOUTS_QUERY, organizationId, outletId],
    queryFn: async (): Promise<Record<string, CategoryLayout>> => {
      if (!organizationId || !outletId) return {};
      const { data, error } = await supabase
        .from("synckerja_order_category_layouts")
        .select("category_id, layout")
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId);
      if (error) throw error;
      const map: Record<string, CategoryLayout> = {};
      for (const row of data ?? []) {
        map[String(row.category_id)] = parseCategoryLayout(row.layout);
      }
      return map;
    },
    enabled: Boolean(organizationId && outletId),
  });

  const save = useMutation({
    mutationFn: async (rows: SynckerjaOrderCategoryLayoutRow[]) => {
      if (!organizationId || !outletId) throw new Error("Organization ID is required");
      if (rows.length === 0) return;
      const { error } = await supabase.from("synckerja_order_category_layouts").upsert(
        rows.map((row) => ({
          organization_id: organizationId,
          outlet_id: outletId,
          category_id: row.category_id,
          layout: parseCategoryLayout(row.layout),
        })),
        { onConflict: "outlet_id,category_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [SYNCKERJA_ORDER_CATEGORY_LAYOUTS_QUERY, organizationId, outletId],
      });
    },
  });

  return {
    ...query,
    layouts: query.data ?? {},
    defaultLayout: DEFAULT_CATEGORY_LAYOUT,
    save,
  };
}
