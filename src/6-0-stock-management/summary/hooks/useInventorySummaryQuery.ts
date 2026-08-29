import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCatalogIngredientStockRealtime } from "@/8-2-3-ingredient/library/hooks/useCatalogIngredientStockRealtime";
import { buildInventorySummaryLines, filterSummaryLines } from "../lib/inventorySummaryMath";
import type {
  CatalogStockMovementRow,
  InventorySummaryKindFilter,
  InventorySummaryLine,
  InventorySummaryStockItem,
} from "../types";

export const INVENTORY_SUMMARY_QUERY_KEY = "inventory-summary";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapMovement(row: Record<string, unknown>): CatalogStockMovementRow {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    outlet_id: String(row.outlet_id),
    item_kind: row.item_kind === "ingredient" ? "ingredient" : "product",
    product_id: (row.product_id as string | null) ?? null,
    variant_id: (row.variant_id as string | null) ?? null,
    ingredient_id: (row.ingredient_id as string | null) ?? null,
    movement_type: row.movement_type as CatalogStockMovementRow["movement_type"],
    qty_delta: num(row.qty_delta),
    qty_after: num(row.qty_after),
    occurred_at: String(row.occurred_at),
  };
}

async function fetchProductItems(args: {
  organizationId: string;
  outletId: string;
}): Promise<InventorySummaryStockItem[]> {
  const { data, error } = await supabase
    .from("default_prices")
    .select("id, name, track_stock, product_category_id, catalog_product_outlets(outlet_id, in_stock), catalog_product_variants(id, name, sort_order)")
    .eq("organization_id", args.organizationId)
    .eq("kind", "product")
    .eq("track_stock", true);
  if (error) throw error;

  const products = (data ?? []) as Array<{
    id: string;
    name: string | null;
    product_category_id: string | null;
    catalog_product_outlets: Array<{ outlet_id: string; in_stock: number | string }> | null;
    catalog_product_variants: Array<{ id: string; name: string; sort_order: number }> | null;
  }>;
  const categoryIds = [...new Set(products.map((row) => row.product_category_id).filter(Boolean))] as string[];
  const { data: categories } = categoryIds.length
    ? await supabase.from("catalog_product_categories").select("id, name").in("id", categoryIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const categoryMap = new Map((categories ?? []).map((row) => [row.id, row.name]));

  const variantIds = products.flatMap((row) => (row.catalog_product_variants ?? []).map((v) => v.id));
  const { data: variantStocks, error: variantError } = variantIds.length
    ? await supabase
        .from("catalog_product_variant_outlets")
        .select("variant_id, outlet_id, in_stock")
        .eq("outlet_id", args.outletId)
        .in("variant_id", variantIds)
    : { data: [] as Array<{ variant_id: string; in_stock: number | string }>, error: null };
  if (variantError) throw variantError;
  const variantQty = new Map(
    (variantStocks ?? []).map((row) => [row.variant_id, num(row.in_stock)]),
  );

  const items: InventorySummaryStockItem[] = [];
  for (const row of products) {
    const assigned = (row.catalog_product_outlets ?? []).some((link) => link.outlet_id === args.outletId);
    if (!assigned) continue;
    const categoryName = row.product_category_id ? (categoryMap.get(row.product_category_id) ?? "") : "";
    const variants = [...(row.catalog_product_variants ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    if (variants.length > 0) {
      items.push({
        itemKind: "product",
        productId: row.id,
        variantId: null,
        ingredientId: null,
        name: row.name?.trim() || "—",
        variantName: null,
        categoryName,
        currentQty: 0,
        isParent: true,
      });
      for (const variant of variants) {
        items.push({
          itemKind: "product",
          productId: row.id,
          variantId: variant.id,
          ingredientId: null,
          name: row.name?.trim() || "—",
          variantName: variant.name,
          categoryName,
          currentQty: variantQty.get(variant.id) ?? 0,
          isParent: false,
        });
      }
      continue;
    }
    const productQty = num(
      (row.catalog_product_outlets ?? []).find((link) => link.outlet_id === args.outletId)?.in_stock,
    );
    items.push({
      itemKind: "product",
      productId: row.id,
      variantId: null,
      ingredientId: null,
      name: row.name?.trim() || "—",
      variantName: null,
      categoryName,
      currentQty: productQty,
      isParent: false,
    });
  }
  return items;
}

async function fetchIngredientItems(args: {
  organizationId: string;
  outletId: string;
}): Promise<InventorySummaryStockItem[]> {
  const { data, error } = await supabase
    .from("catalog_ingredients")
    .select("id, name, track_inventory, category_id, catalog_ingredient_outlets(outlet_id, in_stock)")
    .eq("organization_id", args.organizationId)
    .eq("is_deleted", false)
    .eq("track_inventory", true);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    category_id: string | null;
    catalog_ingredient_outlets: Array<{ outlet_id: string; in_stock: number | string }> | null;
  }>;
  const categoryIds = [...new Set(rows.map((row) => row.category_id).filter(Boolean))] as string[];
  const { data: categories } = categoryIds.length
    ? await supabase.from("catalog_ingredient_categories").select("id, name").in("id", categoryIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const categoryMap = new Map((categories ?? []).map((row) => [row.id, row.name]));
  return rows.flatMap((row) => {
    const stock = (row.catalog_ingredient_outlets ?? []).find((link) => link.outlet_id === args.outletId);
    if (!stock) return [];
    return [
      {
        itemKind: "ingredient" as const,
        productId: null,
        variantId: null,
        ingredientId: row.id,
        name: row.name,
        variantName: null,
        categoryName: row.category_id ? (categoryMap.get(row.category_id) ?? "") : "",
        currentQty: num(stock.in_stock),
        isParent: false,
      },
    ];
  });
}

export function useInventorySummaryQuery(args: {
  organizationId: string | null;
  outletId: string;
  kind: InventorySummaryKindFilter;
  periodStart: Date;
  periodEnd: Date;
  search: string;
}) {
  useCatalogIngredientStockRealtime(args.organizationId, "inventory-summary");

  return useQuery({
    queryKey: [
      INVENTORY_SUMMARY_QUERY_KEY,
      args.organizationId,
      args.outletId,
      args.kind,
      args.periodStart.toISOString(),
      args.periodEnd.toISOString(),
      args.search,
    ],
    queryFn: async (): Promise<InventorySummaryLine[]> => {
      if (!args.organizationId || !args.outletId) return [];
      const items =
        args.kind === "ingredients"
          ? await fetchIngredientItems({ organizationId: args.organizationId, outletId: args.outletId })
          : await fetchProductItems({ organizationId: args.organizationId, outletId: args.outletId });

      const { data, error } = await supabase
        .from("catalog_stock_movements")
        .select(
          "id, organization_id, outlet_id, item_kind, product_id, variant_id, ingredient_id, movement_type, qty_delta, qty_after, occurred_at",
        )
        .eq("organization_id", args.organizationId)
        .eq("outlet_id", args.outletId)
        .eq("item_kind", args.kind === "ingredients" ? "ingredient" : "product")
        .gte("occurred_at", args.periodStart.toISOString())
        .order("occurred_at", { ascending: true });
      if (error) throw error;

      const lines = buildInventorySummaryLines({
        items,
        movements: (data ?? []).map((row) => mapMovement(row as Record<string, unknown>)),
        period: { start: args.periodStart, end: args.periodEnd },
      });
      return filterSummaryLines(lines, args.search);
    },
    enabled: Boolean(args.organizationId && args.outletId),
  });
}
