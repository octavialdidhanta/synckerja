import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { CatalogSalesType, CatalogSalesTypeSave } from "../types";

const QUERY_KEY = "catalog-sales-types";

type SalesTypeRow = Omit<CatalogSalesType, "gratuity_ids" | "outlet_ids"> & {
  catalog_sales_type_gratuities?: Array<{ gratuity_id: string }> | null;
  catalog_sales_type_outlets?: Array<{ outlet_id: string }> | null;
};

function mapRow(row: SalesTypeRow): CatalogSalesType {
  const { catalog_sales_type_gratuities: links, catalog_sales_type_outlets: outletLinks, ...rest } = row;
  return {
    ...rest,
    outlet_ids: (outletLinks ?? []).map((link) => link.outlet_id),
    gratuity_ids: (links ?? []).map((link) => link.gratuity_id),
  };
}

export function useCatalogSalesTypes() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogSalesType[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_sales_types")
        .select(
          "id, organization_id, name, sort_order, is_active, catalog_sales_type_gratuities(gratuity_id), catalog_sales_type_outlets(outlet_id)",
        )
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as SalesTypeRow[]).map(mapRow);
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogSalesTypeSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("sales_type_name_required");
      const uniqueOutletIds = Array.from(new Set(payload.outlet_ids.filter(Boolean)));
      if (uniqueOutletIds.length < 1) throw new Error("sales_type_outlets_min");

      const fields = {
        name,
        is_active: payload.is_active,
      };

      let salesTypeId = payload.id ?? "";
      if (payload.id) {
        const { error } = await supabase.from("catalog_sales_types").update(fields).eq("id", payload.id);
        if (error) throw error;
        salesTypeId = payload.id;
      } else {
        const { data, error } = await supabase
          .from("catalog_sales_types")
          .insert({
            organization_id: organizationId,
            sort_order: (query.data?.length ?? 0) + 1,
            ...fields,
          })
          .select("id")
          .single();
        if (error) throw error;
        salesTypeId = data.id;
      }

      const { error: clearOutletsError } = await supabase
        .from("catalog_sales_type_outlets")
        .delete()
        .eq("sales_type_id", salesTypeId);
      if (clearOutletsError) throw clearOutletsError;
      const { error: outletsError } = await supabase.from("catalog_sales_type_outlets").insert(
        uniqueOutletIds.map((outlet_id) => ({
          sales_type_id: salesTypeId,
          outlet_id,
          organization_id: organizationId,
        })),
      );
      if (outletsError) throw outletsError;

      const { data: existing, error: existingError } = await supabase
        .from("catalog_sales_type_gratuities")
        .select("gratuity_id")
        .eq("sales_type_id", salesTypeId);
      if (existingError) throw existingError;

      const current = new Set((existing ?? []).map((row) => row.gratuity_id));
      const next = new Set(payload.gratuity_ids);
      const toAdd = payload.gratuity_ids.filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !next.has(id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("catalog_sales_type_gratuities")
          .delete()
          .eq("sales_type_id", salesTypeId)
          .in("gratuity_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const { error } = await supabase.from("catalog_sales_type_gratuities").insert(
          toAdd.map((gratuity_id) => ({
            sales_type_id: salesTypeId,
            gratuity_id,
            organization_id: organizationId,
          })),
        );
        if (error) throw error;
      }

      return salesTypeId;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalog_sales_types").delete().eq("id", id);
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
