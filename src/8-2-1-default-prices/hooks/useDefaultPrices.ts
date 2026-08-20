import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { DefaultPriceRow, DefaultPriceCreate, DefaultPriceUpdate } from "../types/defaultPrices";
import { signCatalogProductPhotos } from "../lib/catalogProductPhoto";
import type { CatalogKind } from "../lib/catalogKind";
import { normalizeCatalogPosStatus } from "../lib/catalogKind";
import {
  mapProductOutletLinks,
  resolveOutletOverrideValues,
} from "../product-outlets/lib/effectiveProductOutlet";
import type { ProductOutletOverride } from "../product-outlets/types";

type DefaultPriceQueryRow = DefaultPriceRow & {
  catalog_product_outlets?: Array<{
    outlet_id: string;
    unit_price: number | string | null;
    pos_status: string | null;
  }> | null;
};

function pickMasterFields(payload: DefaultPriceCreate | DefaultPriceUpdate) {
  return {
    name: payload.name ?? null,
    description: payload.description ?? null,
    photo_path: payload.photo_path ?? null,
    unit: payload.unit ?? "pcs",
    track_stock: payload.track_stock ?? false,
    inventory_sku_id: payload.inventory_sku_id ?? null,
    product_category_id: payload.product_category_id ?? null,
    product_brand_id: payload.product_brand_id ?? null,
  };
}

async function replaceProductOutlets(args: {
  productId: string;
  organizationId: string;
  outletIds: string[];
  selectedOutletId: string | null | undefined;
  masterPrice: number;
  masterStatus: ReturnType<typeof normalizeCatalogPosStatus>;
  effectivePrice: number;
  effectiveStatus: ReturnType<typeof normalizeCatalogPosStatus>;
  useDefaultPrice: boolean;
  useDefaultStatus: boolean;
  previousOverrides: Record<string, ProductOutletOverride>;
  isCreate: boolean;
}) {
  const uniqueOutletIds = Array.from(new Set(args.outletIds.filter(Boolean)));
  if (uniqueOutletIds.length < 1) throw new Error("product_outlets_min");

  const selectedOverride = args.selectedOutletId
    ? resolveOutletOverrideValues({
        masterPrice: args.masterPrice,
        masterStatus: args.masterStatus,
        effectivePrice: args.effectivePrice,
        effectiveStatus: args.effectiveStatus,
        useDefaultPrice: args.isCreate || args.useDefaultPrice,
        useDefaultStatus: args.isCreate || args.useDefaultStatus,
      })
    : null;

  const { error: clearError } = await supabase
    .from("catalog_product_outlets")
    .delete()
    .eq("product_id", args.productId);
  if (clearError) throw clearError;

  const { error: insertError } = await supabase.from("catalog_product_outlets").insert(
    uniqueOutletIds.map((outlet_id) => {
      const previous = args.previousOverrides[outlet_id];
      const override =
        outlet_id === args.selectedOutletId && selectedOverride
          ? selectedOverride
          : { unit_price: previous?.unit_price ?? null, pos_status: previous?.pos_status ?? null };
      return {
        product_id: args.productId,
        outlet_id,
        organization_id: args.organizationId,
        unit_price: override.unit_price,
        pos_status: override.pos_status,
      };
    }),
  );
  if (insertError) throw insertError;
}

export function useDefaultPrices() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["default-prices", organizationId],
    queryFn: async (): Promise<DefaultPriceRow[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("default_prices")
        .select("*, catalog_product_outlets(outlet_id, unit_price, pos_status)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const prices = (data ?? []) as DefaultPriceQueryRow[];

      const serviceIds = [...new Set(prices.map((p) => p.service_id).filter(Boolean))] as string[];
      const subIds = [...new Set(prices.map((p) => p.sub_service_id).filter(Boolean))] as string[];
      const skuIds = [...new Set(prices.map((p) => p.inventory_sku_id).filter(Boolean))] as string[];
      const categoryIds = [...new Set(prices.map((p) => p.product_category_id).filter(Boolean))] as string[];
      const brandIds = [...new Set(prices.map((p) => p.product_brand_id).filter(Boolean))] as string[];

      const [servicesRes, subRes, skuRes, levelRes, categoryRes, brandRes, photoMap] = await Promise.all([
        serviceIds.length
          ? supabase.from("services").select("id, name").in("id", serviceIds)
          : { data: [] as Array<{ id: string; name: string }> },
        subIds.length
          ? supabase.from("sub_services").select("id, name").in("id", subIds)
          : { data: [] as Array<{ id: string; name: string }> },
        skuIds.length
          ? supabase.from("inventory_skus").select("id, internal_sku").in("id", skuIds)
          : { data: [] as Array<{ id: string; internal_sku: string }> },
        skuIds.length
          ? supabase.from("inventory_stock_levels").select("sku_id, available_qty").in("sku_id", skuIds)
          : { data: [] as Array<{ sku_id: string; available_qty: number }> },
        categoryIds.length
          ? supabase.from("catalog_product_categories").select("id, name").in("id", categoryIds)
          : { data: [] as Array<{ id: string; name: string }> },
        brandIds.length
          ? supabase.from("catalog_brands").select("id, name").in("id", brandIds)
          : { data: [] as Array<{ id: string; name: string }> },
        signCatalogProductPhotos(prices.map((p) => p.photo_path ?? "")),
      ]);

      const serviceMap = new Map((servicesRes.data ?? []).map((s) => [s.id, s.name]));
      const subMap = new Map((subRes.data ?? []).map((s) => [s.id, s.name]));
      const skuCodeMap = new Map((skuRes.data ?? []).map((s) => [s.id, s.internal_sku]));
      const qtyMap = new Map((levelRes.data ?? []).map((s) => [s.sku_id, Number(s.available_qty)]));
      const categoryMap = new Map((categoryRes.data ?? []).map((s) => [s.id, s.name]));
      const brandMap = new Map((brandRes.data ?? []).map((s) => [s.id, s.name]));

      return prices.map((p) => {
        const { catalog_product_outlets, ...rest } = p;
        const skuCode = rest.inventory_sku_id ? skuCodeMap.get(rest.inventory_sku_id) : undefined;
        const qty = rest.inventory_sku_id ? qtyMap.get(rest.inventory_sku_id) : undefined;
        const kind = (rest.kind === "product" ? "product" : "service") as CatalogKind;
        const outletLinks =
          kind === "product"
            ? mapProductOutletLinks(catalog_product_outlets)
            : { outlet_ids: [] as string[], outlet_overrides: {} };
        return {
          ...rest,
          kind,
          service_name: rest.service_id ? (serviceMap.get(rest.service_id) ?? "") : (rest.name ?? ""),
          sub_service_name: rest.sub_service_id ? (subMap.get(rest.sub_service_id) ?? "") : "",
          photo_url: rest.photo_path ? (photoMap.get(rest.photo_path) ?? null) : null,
          sku_code: skuCode ?? null,
          available_qty: qty ?? null,
          product_category_name: rest.product_category_id ? (categoryMap.get(rest.product_category_id) ?? "") : "",
          product_brand_name: rest.product_brand_id ? (brandMap.get(rest.product_brand_id) ?? "") : "",
          pos_status: rest.pos_status === "sold_out" || rest.pos_status === "hidden" ? rest.pos_status : "available",
          outlet_ids: outletLinks.outlet_ids,
          outlet_overrides: outletLinks.outlet_overrides,
        };
      });
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["default-prices", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["inventory-skus", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["catalog-product-categories", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["catalog-brands", organizationId] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: DefaultPriceCreate) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const kind = payload.kind === "product" ? "product" : "service";
      const masterStatus = normalizeCatalogPosStatus(payload.pos_status);
      const insertRow = {
        id: payload.id,
        organization_id: payload.organization_id,
        kind,
        service_id: payload.service_id,
        sub_service_id: payload.sub_service_id,
        unit_price: payload.unit_price,
        pos_status: masterStatus,
        ...pickMasterFields(payload),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("default_prices").insert(insertRow).select("id").single();
      if (error) throw error;
      const productId = (data.id as string) ?? payload.id;
      if (kind === "product") {
        await replaceProductOutlets({
          productId,
          organizationId,
          outletIds: payload.outlet_ids ?? [],
          selectedOutletId: payload.selected_outlet_id,
          masterPrice: payload.unit_price,
          masterStatus,
          effectivePrice: payload.unit_price,
          effectiveStatus: masterStatus,
          useDefaultPrice: true,
          useDefaultStatus: true,
          previousOverrides: {},
          isCreate: true,
        });
      }
      return data;
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: DefaultPriceUpdate }) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const existing = rows.find((row) => row.id === id);
      const isProduct = existing?.kind === "product" || Boolean(payload.outlet_ids);
      if (!isProduct) {
        const { error } = await supabase
          .from("default_prices")
          .update({
            unit_price: payload.unit_price,
            description: payload.description ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const masterStatus = normalizeCatalogPosStatus(existing?.pos_status ?? payload.pos_status);
      const masterPrice = Number(existing?.unit_price ?? payload.unit_price) || 0;
      const fields: Record<string, unknown> = {
        ...pickMasterFields({ ...existing, ...payload }),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("default_prices").update(fields).eq("id", id);
      if (error) throw error;
      await replaceProductOutlets({
        productId: id,
        organizationId,
        outletIds: payload.outlet_ids ?? existing?.outlet_ids ?? [],
        selectedOutletId: payload.selected_outlet_id,
        masterPrice,
        masterStatus,
        effectivePrice: payload.unit_price ?? masterPrice,
        effectiveStatus: normalizeCatalogPosStatus(payload.pos_status ?? masterStatus),
        useDefaultPrice: Boolean(payload.use_default_price),
        useDefaultStatus: Boolean(payload.use_default_status),
        previousOverrides: payload.outlet_overrides ?? existing?.outlet_overrides ?? {},
        isCreate: false,
      });
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("default_prices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    rows,
    isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
