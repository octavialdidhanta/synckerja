import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { CatalogTax, CatalogTaxSave } from "../types";

export const CATALOG_TAXES_QUERY_KEY = "catalog-taxes";

type TaxRow = Omit<CatalogTax, "outlet_ids"> & {
  catalog_tax_outlets?: Array<{ outlet_id: string }> | null;
};

function mapRow(row: TaxRow): CatalogTax {
  const { catalog_tax_outlets: outletLinks, ...rest } = row;
  return {
    ...rest,
    amount_percent: Number(rest.amount_percent) || 0,
    outlet_ids: (outletLinks ?? []).map((link) => link.outlet_id),
  };
}

export function useCatalogTaxes() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CATALOG_TAXES_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogTax[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_taxes")
        .select(
          "id, organization_id, name, amount_percent, sort_order, is_active, catalog_tax_outlets(outlet_id)",
        )
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as TaxRow[]).map(mapRow);
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [CATALOG_TAXES_QUERY_KEY, organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogTaxSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("tax_name_required");
      const amount = Number(payload.amount_percent);
      if (!Number.isFinite(amount) || amount < 0 || amount > 100) {
        throw new Error("tax_amount_invalid");
      }
      const uniqueOutletIds = Array.from(new Set(payload.outlet_ids.filter(Boolean)));
      if (uniqueOutletIds.length < 1) throw new Error("tax_outlets_min");

      const fields = {
        name,
        amount_percent: Math.round(amount * 100) / 100,
        is_active: true,
      };
      let taxId = payload.id ?? "";
      if (payload.id) {
        const { error } = await supabase.from("catalog_taxes").update(fields).eq("id", payload.id);
        if (error) throw error;
        taxId = payload.id;
      } else {
        const { data, error } = await supabase
          .from("catalog_taxes")
          .insert({
            organization_id: organizationId,
            sort_order: (query.data?.length ?? 0) + 1,
            ...fields,
          })
          .select("id")
          .single();
        if (error) throw error;
        taxId = data.id as string;
      }

      const { error: clearOutletsError } = await supabase
        .from("catalog_tax_outlets")
        .delete()
        .eq("tax_id", taxId);
      if (clearOutletsError) throw clearOutletsError;
      const { error: outletsError } = await supabase.from("catalog_tax_outlets").insert(
        uniqueOutletIds.map((outlet_id) => ({
          tax_id: taxId,
          outlet_id,
          organization_id: organizationId,
        })),
      );
      if (outletsError) throw outletsError;

      return taxId;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalog_taxes").update({ is_active: false }).eq("id", id);
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
