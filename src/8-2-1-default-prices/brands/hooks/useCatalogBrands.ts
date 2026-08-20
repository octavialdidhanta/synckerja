import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { CatalogBrand, CatalogBrandSave } from "../types";

export const CATALOG_BRANDS_QUERY_KEY = "catalog-brands";

type BrandRow = Omit<CatalogBrand, "outlet_ids"> & {
  catalog_brand_outlets?: Array<{ outlet_id: string }> | null;
};

function mapRow(row: BrandRow): CatalogBrand {
  const { catalog_brand_outlets: outletLinks, ...rest } = row;
  return {
    ...rest,
    outlet_ids: (outletLinks ?? []).map((link) => link.outlet_id),
  };
}

export function useCatalogBrands() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CATALOG_BRANDS_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogBrand[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_brands")
        .select("id, organization_id, name, sort_order, is_active, catalog_brand_outlets(outlet_id)")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as BrandRow[]).map(mapRow);
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [CATALOG_BRANDS_QUERY_KEY, organizationId] });
    queryClient.invalidateQueries({ queryKey: ["default-prices", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog", organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogBrandSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("brand_name_required");
      const uniqueOutletIds = Array.from(new Set(payload.outlet_ids.filter(Boolean)));
      if (uniqueOutletIds.length < 1) throw new Error("brand_outlets_min");

      let brandId = payload.id ?? "";
      if (payload.id) {
        const { error } = await supabase.from("catalog_brands").update({ name, is_active: true }).eq("id", payload.id);
        if (error) throw error;
        brandId = payload.id;
      } else {
        const { data, error } = await supabase
          .from("catalog_brands")
          .insert({
            organization_id: organizationId,
            name,
            sort_order: (query.data?.length ?? 0) + 1,
            is_active: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        brandId = data.id as string;
      }

      const { error: clearOutletsError } = await supabase
        .from("catalog_brand_outlets")
        .delete()
        .eq("brand_id", brandId);
      if (clearOutletsError) throw clearOutletsError;
      const { error: outletsError } = await supabase.from("catalog_brand_outlets").insert(
        uniqueOutletIds.map((outlet_id) => ({
          brand_id: brandId,
          outlet_id,
          organization_id: organizationId,
        })),
      );
      if (outletsError) throw outletsError;

      return brandId;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: unlinkError } = await supabase
        .from("default_prices")
        .update({ product_brand_id: null })
        .eq("product_brand_id", id);
      if (unlinkError) throw unlinkError;
      const { error } = await supabase.from("catalog_brands").update({ is_active: false }).eq("id", id);
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
