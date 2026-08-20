import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type {
  CatalogPromo,
  CatalogPromoAmountUnit,
  CatalogPromoRequirement,
  CatalogPromoRequirementKind,
  CatalogPromoSave,
  CatalogPromoSalesTypeScope,
  CatalogPromoType,
} from "../types";

export const CATALOG_PROMOS_QUERY_KEY = "catalog-promos";

const PROMO_SELECT = `
  id, organization_id, name, promo_type, sales_type_scope, applies_in_multiple,
  time_period_enabled, starts_on, ends_on, starts_at_time, ends_at_time,
  reward_amount_unit, reward_amount_value, reward_product_id, reward_quantity,
  sort_order, is_active,
  catalog_promo_sales_types(sales_type_id),
  catalog_promo_outlets(outlet_id),
  catalog_promo_requirements(id, kind, quantity, product_id, category_id, sort_order)
`;

type PromoRow = Omit<CatalogPromo, "sales_type_ids" | "outlet_ids" | "requirements"> & {
  catalog_promo_sales_types?: Array<{ sales_type_id: string }> | null;
  catalog_promo_outlets?: Array<{ outlet_id: string }> | null;
  catalog_promo_requirements?: Array<{
    id: string;
    kind: string;
    quantity: number;
    product_id: string | null;
    category_id: string | null;
    sort_order: number;
  }> | null;
};

function mapType(value: unknown): CatalogPromoType {
  return value === "free_item" ? "free_item" : "discount_per_item";
}

function mapScope(value: unknown): CatalogPromoSalesTypeScope {
  return value === "specific" ? "specific" : "all";
}

function mapUnit(value: unknown): CatalogPromoAmountUnit | null {
  if (value === "rp" || value === "percent") return value;
  return null;
}

function mapKind(value: unknown): CatalogPromoRequirementKind {
  return value === "category" ? "category" : "item";
}

function mapTime(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.slice(0, 5);
}

function mapRow(row: PromoRow): CatalogPromo {
  const requirements = [...(row.catalog_promo_requirements ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((req): CatalogPromoRequirement => ({
      id: req.id,
      kind: mapKind(req.kind),
      quantity: Number(req.quantity) || 1,
      product_id: req.product_id,
      category_id: req.category_id,
    }));
  const rawValue = row.reward_amount_value == null ? null : Number(row.reward_amount_value);
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    promo_type: mapType(row.promo_type),
    sales_type_scope: mapScope(row.sales_type_scope),
    sales_type_ids: (row.catalog_promo_sales_types ?? []).map((link) => link.sales_type_id),
    outlet_ids: (row.catalog_promo_outlets ?? []).map((link) => link.outlet_id),
    applies_in_multiple: Boolean(row.applies_in_multiple),
    time_period_enabled: Boolean(row.time_period_enabled),
    starts_on: row.starts_on,
    ends_on: row.ends_on,
    starts_at_time: mapTime(row.starts_at_time),
    ends_at_time: mapTime(row.ends_at_time),
    reward_amount_unit: mapUnit(row.reward_amount_unit),
    reward_amount_value: rawValue != null && Number.isFinite(rawValue) ? rawValue : null,
    reward_product_id: row.reward_product_id,
    reward_quantity: Number(row.reward_quantity) || 1,
    sort_order: row.sort_order,
    is_active: row.is_active,
    requirements,
  };
}

export function useCatalogPromos() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CATALOG_PROMOS_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogPromo[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_promos")
        .select(PROMO_SELECT)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as PromoRow[]).map(mapRow);
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [CATALOG_PROMOS_QUERY_KEY, organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogPromoSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("promo_name_required");
      if (payload.outlet_ids.length < 1) throw new Error("promo_outlets_min");
      const promo_type = payload.promo_type === "free_item" ? "free_item" : "discount_per_item";
      const sales_type_scope = payload.sales_type_scope === "specific" ? "specific" : "all";
      const time_period_enabled = Boolean(payload.time_period_enabled);
      const fields = {
        name,
        promo_type,
        sales_type_scope,
        applies_in_multiple: Boolean(payload.applies_in_multiple),
        time_period_enabled,
        starts_on: time_period_enabled ? payload.starts_on : null,
        ends_on: time_period_enabled ? payload.ends_on : null,
        starts_at_time: time_period_enabled && payload.starts_at_time ? payload.starts_at_time : null,
        ends_at_time: time_period_enabled && payload.ends_at_time ? payload.ends_at_time : null,
        reward_amount_unit: promo_type === "discount_per_item" ? payload.reward_amount_unit : null,
        reward_amount_value: promo_type === "discount_per_item" ? payload.reward_amount_value : null,
        reward_product_id: promo_type === "free_item" ? payload.reward_product_id : null,
        reward_quantity: promo_type === "free_item" ? Math.max(1, payload.reward_quantity || 1) : 1,
        is_active: true,
      };

      let promoId = payload.id ?? "";
      if (payload.id) {
        const { error } = await supabase.from("catalog_promos").update(fields).eq("id", payload.id);
        if (error) throw error;
        promoId = payload.id;
      } else {
        const { data, error } = await supabase
          .from("catalog_promos")
          .insert({
            organization_id: organizationId,
            sort_order: (query.data?.length ?? 0) + 1,
            ...fields,
          })
          .select("id")
          .single();
        if (error) throw error;
        promoId = data.id as string;
      }

      const { error: clearSalesError } = await supabase
        .from("catalog_promo_sales_types")
        .delete()
        .eq("promo_id", promoId);
      if (clearSalesError) throw clearSalesError;
      if (sales_type_scope === "specific" && payload.sales_type_ids.length > 0) {
        const { error: salesError } = await supabase.from("catalog_promo_sales_types").insert(
          payload.sales_type_ids.map((sales_type_id) => ({
            promo_id: promoId,
            sales_type_id,
            organization_id: organizationId,
          })),
        );
        if (salesError) throw salesError;
      }

      const uniqueOutletIds = Array.from(new Set(payload.outlet_ids.filter(Boolean)));
      if (uniqueOutletIds.length < 1) throw new Error("promo_outlets_min");
      const { error: clearOutletsError } = await supabase
        .from("catalog_promo_outlets")
        .delete()
        .eq("promo_id", promoId);
      if (clearOutletsError) throw clearOutletsError;
      const { error: outletsError } = await supabase.from("catalog_promo_outlets").insert(
        uniqueOutletIds.map((outlet_id) => ({
          promo_id: promoId,
          outlet_id,
          organization_id: organizationId,
        })),
      );
      if (outletsError) throw outletsError;

      const { error: clearReqError } = await supabase
        .from("catalog_promo_requirements")
        .delete()
        .eq("promo_id", promoId);
      if (clearReqError) throw clearReqError;
      const { error: reqError } = await supabase.from("catalog_promo_requirements").insert(
        payload.requirements.map((req, index) => ({
          promo_id: promoId,
          organization_id: organizationId,
          kind: req.kind,
          quantity: req.quantity,
          product_id: req.kind === "item" ? req.product_id : null,
          category_id: req.kind === "category" ? req.category_id : null,
          sort_order: index + 1,
        })),
      );
      if (reqError) throw reqError;
      return promoId;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalog_promos").update({ is_active: false }).eq("id", id);
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
