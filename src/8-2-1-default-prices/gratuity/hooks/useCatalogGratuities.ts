import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { CatalogGratuity, CatalogGratuitySave } from "../types";

export const CATALOG_GRATUITIES_QUERY_KEY = "catalog-gratuities";

type GratuityRow = Omit<CatalogGratuity, "outlet_ids"> & {
  catalog_gratuity_outlets?: Array<{ outlet_id: string }> | null;
};

function mapRow(row: GratuityRow): CatalogGratuity {
  const { catalog_gratuity_outlets: outletLinks, ...rest } = row;
  return {
    ...rest,
    amount_percent: Number(rest.amount_percent) || 0,
    outlet_ids: (outletLinks ?? []).map((link) => link.outlet_id),
  };
}

export function useCatalogGratuities() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CATALOG_GRATUITIES_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogGratuity[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_gratuities")
        .select(
          "id, organization_id, name, amount_percent, sort_order, is_active, catalog_gratuity_outlets(outlet_id)",
        )
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as GratuityRow[]).map(mapRow);
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [CATALOG_GRATUITIES_QUERY_KEY, organizationId] });
    queryClient.invalidateQueries({ queryKey: ["catalog-sales-types", organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogGratuitySave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("gratuity_name_required");
      const amount = Number(payload.amount_percent);
      if (!Number.isFinite(amount) || amount < 0 || amount > 100) {
        throw new Error("gratuity_amount_invalid");
      }
      const uniqueOutletIds = Array.from(new Set(payload.outlet_ids.filter(Boolean)));
      if (uniqueOutletIds.length < 1) throw new Error("gratuity_outlets_min");

      const fields = {
        name,
        amount_percent: Math.round(amount * 100) / 100,
        is_active: true,
      };
      let gratuityId = payload.id ?? "";
      if (payload.id) {
        const { error } = await supabase.from("catalog_gratuities").update(fields).eq("id", payload.id);
        if (error) throw error;
        gratuityId = payload.id;
      } else {
        const { data, error } = await supabase
          .from("catalog_gratuities")
          .insert({
            organization_id: organizationId,
            sort_order: (query.data?.length ?? 0) + 1,
            ...fields,
          })
          .select("id")
          .single();
        if (error) throw error;
        gratuityId = data.id as string;
      }

      const { error: clearOutletsError } = await supabase
        .from("catalog_gratuity_outlets")
        .delete()
        .eq("gratuity_id", gratuityId);
      if (clearOutletsError) throw clearOutletsError;
      const { error: outletsError } = await supabase.from("catalog_gratuity_outlets").insert(
        uniqueOutletIds.map((outlet_id) => ({
          gratuity_id: gratuityId,
          outlet_id,
          organization_id: organizationId,
        })),
      );
      if (outletsError) throw outletsError;

      return gratuityId;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: unlinkError } = await supabase
        .from("catalog_sales_type_gratuities")
        .delete()
        .eq("gratuity_id", id);
      if (unlinkError) throw unlinkError;
      const { error } = await supabase.from("catalog_gratuities").update({ is_active: false }).eq("id", id);
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
