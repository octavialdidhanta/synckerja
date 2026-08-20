import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export type AdjustableProduct = {
  productId: string;
  productName: string;
  // If variants.length > 0, adjustment is done per-variant (parent qty is not used).
  variants: Array<{ variantId: string; variantName: string; inStock: number }>;
  inStock: number; // for non-variant products only
};

const INVENTORY_ADJUSTABLE_PRODUCTS_QUERY_KEY = "inventory-adjustable-products";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function useAdjustableProductsQuery(args: { organizationId: string | null; outletId: string | null }) {
  return useQuery({
    queryKey: [INVENTORY_ADJUSTABLE_PRODUCTS_QUERY_KEY, args.organizationId, args.outletId],
    enabled: Boolean(args.organizationId && args.outletId),
    queryFn: async (): Promise<AdjustableProduct[]> => {
      if (!args.organizationId || !args.outletId) return [];

      const { data, error } = await supabase
        .from("default_prices")
        .select("id, name, track_stock, catalog_product_outlets(outlet_id, in_stock), catalog_product_variants(id, name, sort_order)")
        .eq("organization_id", args.organizationId)
        .eq("kind", "product")
        .eq("track_stock", true);
      if (error) throw error;

      const products = (data ?? []) as Array<{
        id: string;
        name: string | null;
        catalog_product_outlets: Array<{ outlet_id: string; in_stock: number | string }> | null;
        catalog_product_variants: Array<{ id: string; name: string; sort_order: number }> | null;
      }>;

      const productsWithVariants = products.filter((p) => (p.catalog_product_variants ?? []).length > 0);
      const variantIds = productsWithVariants.flatMap((p) => (p.catalog_product_variants ?? []).map((v) => v.id));

      const { data: variantStocks, error: variantError } = variantIds.length
        ? await supabase
            .from("catalog_product_variant_outlets")
            .select("variant_id, outlet_id, in_stock")
            .eq("outlet_id", args.outletId)
            .in("variant_id", variantIds)
        : { data: [] as Array<{ variant_id: string; in_stock: number | string }>, error: null };
      if (variantError) throw variantError;

      const variantQty = new Map((variantStocks ?? []).map((r) => [String(r.variant_id), num(r.in_stock)]));

      const adjustable: AdjustableProduct[] = [];
      for (const row of products) {
        const assigned = (row.catalog_product_outlets ?? []).some((link) => link.outlet_id === args.outletId);
        if (!assigned) continue;

        const variants = (row.catalog_product_variants ?? []).sort((a, b) => a.sort_order - b.sort_order);
        const productName = row.name?.trim() || "—";
        if (variants.length > 0) {
          adjustable.push({
            productId: row.id,
            productName,
            variants: variants.map((v) => ({
              variantId: v.id,
              variantName: v.name,
              inStock: variantQty.get(v.id) ?? 0,
            })),
            inStock: 0,
          });
          continue;
        }

        const productStock = num((row.catalog_product_outlets ?? []).find((l) => l.outlet_id === args.outletId)?.in_stock);
        adjustable.push({
          productId: row.id,
          productName,
          variants: [],
          inStock: productStock,
        });
      }

      adjustable.sort((a, b) => a.productName.localeCompare(b.productName));
      return adjustable;
    },
  });
}

