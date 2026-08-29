import { useQuery } from "@tanstack/react-query";
import { signCatalogProductPhotos } from "@/8-2-1-default-prices/lib/catalogProductPhoto";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PosOutletBundle } from "../lib/bundles";

export const POS_OUTLET_BUNDLES_QUERY_KEY = "pos-outlet-bundles";

const BUNDLE_SELECT = `
  id, name, photo_path, bundle_price, use_sales_type_prices, sort_order,
  catalog_bundle_items(product_id, quantity, sort_order),
  catalog_bundle_outlets(outlet_id),
  catalog_bundle_sales_type_prices(sales_type_id, price)
`;

type BundleRow = {
  id: string;
  name: string | null;
  photo_path: string | null;
  bundle_price: number | string | null;
  use_sales_type_prices: boolean | null;
  catalog_bundle_items?: Array<{
    product_id: string;
    quantity: number;
    sort_order: number;
  }> | null;
  catalog_bundle_outlets?: Array<{ outlet_id: string }> | null;
  catalog_bundle_sales_type_prices?: Array<{
    sales_type_id: string;
    price: number | string;
  }> | null;
};

function mapRow(row: BundleRow, photoUrl: string | null): PosOutletBundle {
  const rawPrice = Number(row.bundle_price);
  const items = [...(row.catalog_bundle_items ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      productId: item.product_id,
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));
  const salesTypePrices = (row.catalog_bundle_sales_type_prices ?? []).map((link) => {
    const price = Number(link.price);
    return {
      salesTypeId: link.sales_type_id,
      price: Number.isFinite(price) && price >= 0 ? price : 0,
    };
  });
  return {
    id: String(row.id),
    name: String(row.name ?? "").trim() || "—",
    photoUrl,
    bundlePrice: Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0,
    useSalesTypePrices: Boolean(row.use_sales_type_prices),
    salesTypePrices,
    items,
  };
}

/**
 * Active catalog bundles assigned to the current POS outlet (read-only).
 */
export function usePosOutletBundles(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const enabled = Boolean(organizationId && outletId);

  return useQuery({
    queryKey: [POS_OUTLET_BUNDLES_QUERY_KEY, organizationId, outletId],
    enabled,
    queryFn: async (): Promise<PosOutletBundle[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("catalog_bundles")
        .select(BUNDLE_SELECT)
        .eq("organization_id", organizationId)
        .eq("is_deleted", false)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      const rows = ((data ?? []) as BundleRow[]).filter((row) =>
        (row.catalog_bundle_outlets ?? []).some((link) => link.outlet_id === outletId),
      );
      const photoMap = await signCatalogProductPhotos(rows.map((row) => row.photo_path ?? ""));
      return rows.map((row) =>
        mapRow(row, row.photo_path ? (photoMap.get(row.photo_path) ?? null) : null),
      );
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
