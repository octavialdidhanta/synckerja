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
import { emptyOutletStock } from "../product-variants/types";
import { syncCatalogStockToTarget } from "@/stock-management/catalog-ledger/applyCatalogStockMovement";
import type {
  CatalogProductSalesTypePrice,
  CatalogProductVariant,
  CatalogProductVariantOutletStock,
  ProductOutletStock,
} from "../product-variants/types";

type DefaultPriceQueryRow = DefaultPriceRow & {
  sku?: string | null;
  catalog_product_outlets?: Array<{
    outlet_id: string;
    unit_price: number | string | null;
    pos_status: string | null;
    in_stock?: number | string | null;
    alert_enabled?: boolean | null;
    alert_at?: number | string | null;
    track_cogs?: boolean | null;
    avg_cost?: number | string | null;
  }> | null;
  catalog_product_variants?: Array<{
    id: string;
    name: string;
    sku: string | null;
    price: number | string;
    sort_order: number;
  }> | null;
  catalog_product_sales_type_prices?: Array<{
    variant_id: string | null;
    sales_type_id: string;
    price: number | string;
  }> | null;
};

function mapOutletStock(link: NonNullable<DefaultPriceQueryRow["catalog_product_outlets"]>[number]): ProductOutletStock {
  const inStock = Number(link.in_stock);
  const alertAt = link.alert_at == null || link.alert_at === "" ? null : Number(link.alert_at);
  const avgCost = Number(link.avg_cost);
  return {
    in_stock: Number.isFinite(inStock) && inStock >= 0 ? inStock : 0,
    alert_enabled: Boolean(link.alert_enabled),
    alert_at: alertAt != null && Number.isFinite(alertAt) && alertAt >= 0 ? alertAt : null,
    track_cogs: Boolean(link.track_cogs),
    avg_cost: Number.isFinite(avgCost) && avgCost >= 0 ? avgCost : 0,
  };
}

function stockInsertFields(stock?: ProductOutletStock | null) {
  const row = stock ?? emptyOutletStock();
  return {
    in_stock: row.in_stock,
    alert_enabled: row.alert_enabled,
    alert_at: row.alert_at,
    track_cogs: row.track_cogs,
    avg_cost: row.avg_cost,
  };
}

function pickMasterFields(payload: DefaultPriceCreate | DefaultPriceUpdate) {
  return {
    name: payload.name ?? null,
    description: payload.description ?? null,
    photo_path: payload.photo_path ?? null,
    unit: payload.unit ?? "pcs",
    track_stock: payload.track_stock ?? false,
    inventory_sku_id: payload.inventory_sku_id ?? null,
    sku: payload.catalog_sku?.trim() || null,
    use_sales_type_prices: Boolean(payload.use_sales_type_prices),
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
  previousStocks: Record<string, ProductOutletStock>;
  selectedStock: ProductOutletStock | null | undefined;
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
        ...stockInsertFields(
          outlet_id === args.selectedOutletId
            ? {
                ...(args.selectedStock ?? args.previousStocks[outlet_id]),
                in_stock: args.previousStocks[outlet_id]?.in_stock ?? 0,
              }
            : args.previousStocks[outlet_id],
        ),
      };
    }),
  );
  if (insertError) throw insertError;
}

async function persistProductCatalogExtras(args: {
  productId: string;
  organizationId: string;
  selectedOutletId: string | null | undefined;
  outletIds: string[];
  variants: CatalogProductVariant[];
  salesTypePrices: CatalogProductSalesTypePrice[];
  variantOutletStocks: CatalogProductVariantOutletStock[];
  previousVariantStocks?: CatalogProductVariantOutletStock[];
}) {
  const { error: clearPricesError } = await supabase
    .from("catalog_product_sales_type_prices")
    .delete()
    .eq("product_id", args.productId);
  if (clearPricesError) throw clearPricesError;

  const { data: existingVariants, error: existingError } = await supabase
    .from("catalog_product_variants")
    .select("id")
    .eq("product_id", args.productId);
  if (existingError) throw existingError;
  const keepIds = new Set(args.variants.map((row) => row.id));
  const toDelete = ((existingVariants ?? []) as Array<{ id: string }>).filter((row) => !keepIds.has(row.id)).map((row) => row.id);
  if (toDelete.length > 0) {
    const { error } = await supabase.from("catalog_product_variants").delete().in("id", toDelete);
    if (error) throw error;
  }

  if (args.variants.length > 0) {
    const { error } = await supabase.from("catalog_product_variants").upsert(
      args.variants.map((row, index) => ({
        id: row.id,
        organization_id: args.organizationId,
        product_id: args.productId,
        name: row.name,
        sku: row.sku,
        price: row.price,
        sort_order: index + 1,
      })),
    );
    if (error) throw error;
  }

  if (args.salesTypePrices.length > 0) {
    const { error } = await supabase.from("catalog_product_sales_type_prices").insert(
      args.salesTypePrices.map((row) => ({
        product_id: args.productId,
        variant_id: args.variants.length > 0 ? row.variant_id : null,
        sales_type_id: row.sales_type_id,
        organization_id: args.organizationId,
        price: row.price,
      })),
    );
    if (error) throw error;
  }

  const outletId = args.selectedOutletId;
  if (!outletId || args.variants.length === 0) return;
  const stockByVariant = new Map(
    args.variantOutletStocks.filter((row) => row.outlet_id === outletId).map((row) => [row.variant_id, row]),
  );
  const previousByVariant = new Map(
    (args.previousVariantStocks ?? [])
      .filter((row) => row.outlet_id === outletId)
      .map((row) => [row.variant_id, row]),
  );
  const { error: stockError } = await supabase.from("catalog_product_variant_outlets").upsert(
    args.variants.map((variant) => {
      const next = stockByVariant.get(variant.id);
      const previous = previousByVariant.get(variant.id);
      return {
        variant_id: variant.id,
        outlet_id: outletId,
        organization_id: args.organizationId,
        ...stockInsertFields({
          ...(next ?? previous),
          in_stock: previous?.in_stock ?? 0,
        }),
      };
    }),
    { onConflict: "variant_id,outlet_id" },
  );
  if (stockError) throw stockError;
}

async function persistProductStockLedger(args: {
  organizationId: string;
  productId: string;
  outletId: string | null | undefined;
  trackStock: boolean;
  previouslyTracked: boolean;
  variants: CatalogProductVariant[];
  selectedStock?: ProductOutletStock | null;
  previousProductStock?: ProductOutletStock | null;
  variantOutletStocks: CatalogProductVariantOutletStock[];
  previousVariantStocks: CatalogProductVariantOutletStock[];
}) {
  if (!args.outletId || !args.trackStock) return;
  if (args.variants.length === 0) {
    await syncCatalogStockToTarget({
      organizationId: args.organizationId,
      outletId: args.outletId,
      itemKind: "product",
      productId: args.productId,
      previousQty: args.previousProductStock?.in_stock ?? 0,
      targetQty: args.selectedStock?.in_stock ?? 0,
      previouslyTracked: args.previouslyTracked,
    });
    return;
  }
  const previousByVariant = new Map(
    args.previousVariantStocks
      .filter((row) => row.outlet_id === args.outletId)
      .map((row) => [row.variant_id, row.in_stock]),
  );
  for (const variant of args.variants) {
    const next = args.variantOutletStocks.find(
      (row) => row.variant_id === variant.id && row.outlet_id === args.outletId,
    );
    await syncCatalogStockToTarget({
      organizationId: args.organizationId,
      outletId: args.outletId,
      itemKind: "product",
      productId: args.productId,
      variantId: variant.id,
      previousQty: previousByVariant.get(variant.id) ?? 0,
      targetQty: next?.in_stock ?? 0,
      previouslyTracked: args.previouslyTracked,
    });
  }
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
        .select(
          "*, catalog_product_outlets(outlet_id, unit_price, pos_status, in_stock, alert_enabled, alert_at, track_cogs, avg_cost), catalog_product_variants(id, name, sku, price, sort_order), catalog_product_sales_type_prices(variant_id, sales_type_id, price)",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const prices = (data ?? []) as DefaultPriceQueryRow[];

      const serviceIds = [...new Set(prices.map((p) => p.service_id).filter(Boolean))] as string[];
      const subIds = [...new Set(prices.map((p) => p.sub_service_id).filter(Boolean))] as string[];
      const skuIds = [...new Set(prices.map((p) => p.inventory_sku_id).filter(Boolean))] as string[];
      const categoryIds = [...new Set(prices.map((p) => p.product_category_id).filter(Boolean))] as string[];
      const brandIds = [...new Set(prices.map((p) => p.product_brand_id).filter(Boolean))] as string[];
      const variantIds = prices.flatMap((p) => (p.catalog_product_variants ?? []).map((row) => row.id));

      const [servicesRes, subRes, skuRes, levelRes, categoryRes, brandRes, photoMap, variantStockRes] = await Promise.all([
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
        variantIds.length
          ? supabase
              .from("catalog_product_variant_outlets")
              .select("variant_id, outlet_id, in_stock, alert_enabled, alert_at, track_cogs, avg_cost")
              .in("variant_id", variantIds)
          : { data: [] as Array<CatalogProductVariantOutletStock> },
      ]);

      const serviceMap = new Map((servicesRes.data ?? []).map((s) => [s.id, s.name]));
      const subMap = new Map((subRes.data ?? []).map((s) => [s.id, s.name]));
      const skuCodeMap = new Map((skuRes.data ?? []).map((s) => [s.id, s.internal_sku]));
      const qtyMap = new Map((levelRes.data ?? []).map((s) => [s.sku_id, Number(s.available_qty)]));
      const categoryMap = new Map((categoryRes.data ?? []).map((s) => [s.id, s.name]));
      const brandMap = new Map((brandRes.data ?? []).map((s) => [s.id, s.name]));
      const variantStocks = ((variantStockRes.data ?? []) as Array<{
        variant_id: string;
        outlet_id: string;
        in_stock: number | string;
        alert_enabled: boolean;
        alert_at: number | string | null;
        track_cogs: boolean;
        avg_cost: number | string;
      }>).map((row) => ({
        variant_id: row.variant_id,
        outlet_id: row.outlet_id,
        ...mapOutletStock(row),
      }));

      return prices.map((p) => {
        const {
          catalog_product_outlets,
          catalog_product_variants,
          catalog_product_sales_type_prices,
          sku,
          ...rest
        } = p;
        const skuCode = rest.inventory_sku_id ? skuCodeMap.get(rest.inventory_sku_id) : undefined;
        const kind = (rest.kind === "product" ? "product" : "service") as CatalogKind;
        const outletLinks =
          kind === "product"
            ? mapProductOutletLinks(catalog_product_outlets)
            : { outlet_ids: [] as string[], outlet_overrides: {} };
        const outlet_stocks: Record<string, ProductOutletStock> = {};
        for (const link of catalog_product_outlets ?? []) {
          if (link.outlet_id) outlet_stocks[link.outlet_id] = mapOutletStock(link);
        }
        const variants: CatalogProductVariant[] = (catalog_product_variants ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((row) => ({
            id: row.id,
            name: row.name,
            sku: row.sku ?? null,
            price: Number(row.price) || 0,
            sort_order: row.sort_order,
          }));
        const variantIdSet = new Set(variants.map((row) => row.id));
        const sales_type_prices: CatalogProductSalesTypePrice[] = (catalog_product_sales_type_prices ?? []).map(
          (row) => ({
            variant_id: row.variant_id ?? null,
            sales_type_id: row.sales_type_id,
            price: Number(row.price) || 0,
          }),
        );
        const variant_outlet_stocks = variantStocks.filter((row) => variantIdSet.has(row.variant_id));
        const qtyFromVariants = variant_outlet_stocks.reduce((sum, row) => sum + row.in_stock, 0);
        const qtyFromProduct = Object.values(outlet_stocks).reduce((sum, row) => sum + row.in_stock, 0);
        const qty = rest.track_stock
          ? variants.length > 0
            ? qtyFromVariants
            : qtyFromProduct
          : rest.inventory_sku_id
            ? qtyMap.get(rest.inventory_sku_id)
            : null;
        return {
          ...rest,
          kind,
          catalog_sku: sku ?? null,
          use_sales_type_prices: Boolean(rest.use_sales_type_prices),
          variants,
          sales_type_prices,
          outlet_stocks,
          variant_outlet_stocks,
          service_name: rest.service_id ? (serviceMap.get(rest.service_id) ?? "") : (rest.name ?? ""),
          sub_service_name: rest.sub_service_id ? (subMap.get(rest.sub_service_id) ?? "") : "",
          photo_url: rest.photo_path ? (photoMap.get(rest.photo_path) ?? null) : null,
          sku_code: skuCode ?? sku ?? null,
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
    queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
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
          previousStocks: {},
          selectedStock: payload.selected_outlet_stock,
          isCreate: true,
        });
        await persistProductCatalogExtras({
          productId,
          organizationId,
          selectedOutletId: payload.selected_outlet_id,
          outletIds: payload.outlet_ids ?? [],
          variants: payload.variants ?? [],
          salesTypePrices: payload.sales_type_prices ?? [],
          variantOutletStocks: payload.variant_outlet_stocks ?? [],
        });
        await persistProductStockLedger({
          organizationId,
          productId,
          outletId: payload.selected_outlet_id,
          trackStock: Boolean(payload.track_stock),
          previouslyTracked: false,
          variants: payload.variants ?? [],
          selectedStock: payload.selected_outlet_stock,
          previousProductStock: null,
          variantOutletStocks: payload.variant_outlet_stocks ?? [],
          previousVariantStocks: [],
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
        ...pickMasterFields({ ...existing, ...payload, catalog_sku: payload.catalog_sku ?? existing?.catalog_sku }),
        unit_price: payload.unit_price ?? masterPrice,
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
        previousStocks: existing?.outlet_stocks ?? {},
        selectedStock: payload.selected_outlet_stock,
        isCreate: false,
      });
      await persistProductCatalogExtras({
        productId: id,
        organizationId,
        selectedOutletId: payload.selected_outlet_id,
        outletIds: payload.outlet_ids ?? existing?.outlet_ids ?? [],
        variants: payload.variants ?? existing?.variants ?? [],
        salesTypePrices: payload.sales_type_prices ?? existing?.sales_type_prices ?? [],
        variantOutletStocks: payload.variant_outlet_stocks ?? existing?.variant_outlet_stocks ?? [],
        previousVariantStocks: existing?.variant_outlet_stocks ?? [],
      });
      const outletId = payload.selected_outlet_id;
      await persistProductStockLedger({
        organizationId,
        productId: id,
        outletId,
        trackStock: Boolean(payload.track_stock ?? existing?.track_stock),
        previouslyTracked: Boolean(existing?.track_stock),
        variants: payload.variants ?? existing?.variants ?? [],
        selectedStock: payload.selected_outlet_stock,
        previousProductStock: outletId ? existing?.outlet_stocks?.[outletId] : null,
        variantOutletStocks: payload.variant_outlet_stocks ?? [],
        previousVariantStocks: existing?.variant_outlet_stocks ?? [],
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
