import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type {
  CatalogDiscount,
  CatalogDiscountAmountUnit,
  CatalogDiscountInputConfiguration,
  CatalogDiscountSave,
} from "../types";

export const CATALOG_DISCOUNTS_QUERY_KEY = "catalog-discounts";

type DiscountRow = Omit<CatalogDiscount, "outlet_ids"> & {
  catalog_discount_outlets?: Array<{ outlet_id: string }> | null;
};

function mapConfiguration(value: unknown): CatalogDiscountInputConfiguration {
  return value === "customizable" ? "customizable" : "fixed";
}

function mapUnit(value: unknown): CatalogDiscountAmountUnit | null {
  if (value === "rp" || value === "percent") return value;
  return null;
}

function mapRow(row: DiscountRow): CatalogDiscount {
  const { catalog_discount_outlets: outletLinks, ...rest } = row;
  const input_configuration = mapConfiguration(rest.input_configuration);
  const amount_unit = input_configuration === "customizable" ? null : mapUnit(rest.amount_unit);
  const rawValue = rest.amount_value == null ? null : Number(rest.amount_value);
  const amount_value =
    input_configuration === "customizable" || rawValue == null || !Number.isFinite(rawValue) ? null : rawValue;
  return {
    ...rest,
    input_configuration,
    amount_unit,
    amount_value,
    outlet_ids: (outletLinks ?? []).map((link) => link.outlet_id),
  };
}

export function useCatalogDiscounts() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CATALOG_DISCOUNTS_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogDiscount[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_discounts")
        .select(
          "id, organization_id, name, input_configuration, amount_unit, amount_value, sort_order, is_active, catalog_discount_outlets(outlet_id)",
        )
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as DiscountRow[]).map(mapRow);
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [CATALOG_DISCOUNTS_QUERY_KEY, organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogDiscountSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("discount_name_required");
      const uniqueOutletIds = Array.from(new Set(payload.outlet_ids.filter(Boolean)));
      if (uniqueOutletIds.length < 1) throw new Error("discount_outlets_min");
      const input_configuration =
        payload.input_configuration === "customizable" ? "customizable" : "fixed";
      let amount_unit: CatalogDiscountAmountUnit | null = null;
      let amount_value: number | null = null;
      if (input_configuration === "fixed") {
        const unit = payload.amount_unit === "percent" ? "percent" : payload.amount_unit === "rp" ? "rp" : null;
        const amount = Number(payload.amount_value);
        if (!unit || !Number.isFinite(amount) || amount < 0) {
          throw new Error("discount_amount_invalid");
        }
        if (unit === "percent" && amount > 100) {
          throw new Error("discount_amount_invalid");
        }
        amount_unit = unit;
        amount_value = unit === "percent" ? Math.round(amount * 10) / 10 : Math.round(amount * 100) / 100;
      }
      const fields = {
        name,
        input_configuration,
        amount_unit,
        amount_value,
        is_active: true,
      };
      let discountId = payload.id ?? "";
      if (payload.id) {
        const { error } = await supabase.from("catalog_discounts").update(fields).eq("id", payload.id);
        if (error) throw error;
        discountId = payload.id;
      } else {
        const { data, error } = await supabase
          .from("catalog_discounts")
          .insert({
            organization_id: organizationId,
            sort_order: (query.data?.length ?? 0) + 1,
            ...fields,
          })
          .select("id")
          .single();
        if (error) throw error;
        discountId = data.id as string;
      }

      const { error: clearOutletsError } = await supabase
        .from("catalog_discount_outlets")
        .delete()
        .eq("discount_id", discountId);
      if (clearOutletsError) throw clearOutletsError;
      const { error: outletsError } = await supabase.from("catalog_discount_outlets").insert(
        uniqueOutletIds.map((outlet_id) => ({
          discount_id: discountId,
          outlet_id,
          organization_id: organizationId,
        })),
      );
      if (outletsError) throw outletsError;

      return discountId;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalog_discounts").update({ is_active: false }).eq("id", id);
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
