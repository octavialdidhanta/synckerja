import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type {
  PosLibraryCategoryMeta,
  PosLibraryCategoryOrderRow,
} from "../lib/posLibrarySections";

export const POS_LIBRARY_CATEGORY_ORDER_QUERY_KEY = "pos-library-category-order";
export const POS_LIBRARY_OUTLET_CATEGORIES_QUERY_KEY = "pos-library-outlet-categories";

const ORDER_COLS =
  "id, organization_id, outlet_id, category_id, sort_order, created_at, updated_at";

/**
 * Outlet-scoped Library categories (active + assigned) and custom display order.
 */
export function usePosLibraryCategoryOrder(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const enabled = Boolean(organizationId && outletId);

  const categoriesQuery = useQuery({
    queryKey: [POS_LIBRARY_OUTLET_CATEGORIES_QUERY_KEY, organizationId, outletId],
    enabled,
    queryFn: async (): Promise<PosLibraryCategoryMeta[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("catalog_product_categories")
        .select(
          "id, name, sort_order, is_active, catalog_product_category_outlets(outlet_id)",
        )
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((row) =>
          ((row.catalog_product_category_outlets as Array<{ outlet_id: string }> | null) ?? []).some(
            (o) => o.outlet_id === outletId,
          ),
        )
        .map((row) => ({
          id: String(row.id),
          name: String(row.name ?? "").trim() || "—",
          sort_order: Number(row.sort_order) || 0,
        }));
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const orderQuery = useQuery({
    queryKey: [POS_LIBRARY_CATEGORY_ORDER_QUERY_KEY, organizationId, outletId],
    enabled,
    queryFn: async (): Promise<PosLibraryCategoryOrderRow[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("pos_outlet_library_category_order")
        .select(ORDER_COLS)
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PosLibraryCategoryOrderRow[];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => {
    if (!organizationId || !outletId) return;
    void queryClient.invalidateQueries({
      queryKey: [POS_LIBRARY_CATEGORY_ORDER_QUERY_KEY, organizationId, outletId],
    });
  };

  const reorderCategories = useMutation({
    mutationFn: async (orderedCategoryIds: string[]): Promise<void> => {
      if (!organizationId || !outletId) throw new Error("Organization/outlet required");
      const existing = orderQuery.data ?? [];
      const byCategory = new Map(existing.map((r) => [r.category_id, r]));

      for (let index = 0; index < orderedCategoryIds.length; index++) {
        const categoryId = orderedCategoryIds[index]!;
        const row = byCategory.get(categoryId);
        if (row) {
          if (row.sort_order === index) continue;
          const { error } = await supabase
            .from("pos_outlet_library_category_order")
            .update({ sort_order: index })
            .eq("id", row.id)
            .eq("organization_id", organizationId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("pos_outlet_library_category_order").insert({
            organization_id: organizationId,
            outlet_id: outletId,
            category_id: categoryId,
            sort_order: index,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: invalidate,
  });

  const orderByCategoryId = new Map(
    (orderQuery.data ?? []).map((r) => [r.category_id, r.sort_order]),
  );

  return {
    categories: categoriesQuery.data ?? [],
    orderByCategoryId,
    isLoading: enabled
      ? categoriesQuery.isLoading || orderQuery.isLoading
      : false,
    reorderCategories,
  };
}
