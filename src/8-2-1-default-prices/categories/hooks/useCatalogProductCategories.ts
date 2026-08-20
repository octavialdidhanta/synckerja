import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { CatalogProductCategory, CatalogProductCategorySave } from "../types";

const QUERY_KEY = "catalog-product-categories";

type CategoryRow = Omit<CatalogProductCategory, "outlet_ids"> & {
  catalog_product_category_outlets?: Array<{ outlet_id: string }> | null;
};

function mapCategory(row: CategoryRow): CatalogProductCategory {
  const { catalog_product_category_outlets: outletLinks, ...rest } = row;
  return {
    ...rest,
    outlet_ids: (outletLinks ?? []).map((link) => link.outlet_id),
  };
}

export function useCatalogProductCategories() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogProductCategory[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_product_categories")
        .select(
          "id, organization_id, name, sort_order, is_active, catalog_product_category_outlets(outlet_id)",
        )
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as CategoryRow[]).map(mapCategory);
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, organizationId] });
    queryClient.invalidateQueries({ queryKey: ["default-prices", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog", organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogProductCategorySave): Promise<CatalogProductCategory> => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("category_name_required");
      const uniqueOutletIds = Array.from(new Set(payload.outlet_ids.filter(Boolean)));
      if (uniqueOutletIds.length < 1) throw new Error("category_outlets_min");

      let categoryId = payload.id ?? "";
      let sortOrder = 0;
      if (payload.id) {
        const { error } = await supabase
          .from("catalog_product_categories")
          .update({ name })
          .eq("id", payload.id);
        if (error) throw error;
        categoryId = payload.id;
        sortOrder = query.data?.find((row) => row.id === payload.id)?.sort_order ?? 0;
      } else {
        const { data, error } = await supabase
          .from("catalog_product_categories")
          .insert({
            organization_id: organizationId,
            name,
            sort_order: (query.data?.length ?? 0) + 1,
            is_active: true,
          })
          .select("id, sort_order")
          .single();
        if (error) throw error;
        categoryId = data.id;
        sortOrder = data.sort_order ?? 0;
      }

      const { error: clearOutletsError } = await supabase
        .from("catalog_product_category_outlets")
        .delete()
        .eq("category_id", categoryId);
      if (clearOutletsError) throw clearOutletsError;
      const { error: outletsError } = await supabase.from("catalog_product_category_outlets").insert(
        uniqueOutletIds.map((outlet_id) => ({
          category_id: categoryId,
          outlet_id,
          organization_id: organizationId,
        })),
      );
      if (outletsError) throw outletsError;

      return {
        id: categoryId,
        organization_id: organizationId,
        name,
        sort_order: sortOrder,
        is_active: true,
        outlet_ids: uniqueOutletIds,
      };
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("catalog_product_categories")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    save: save.mutateAsync,
    remove: remove.mutateAsync,
    isSaving: save.isPending || remove.isPending,
  };
}
