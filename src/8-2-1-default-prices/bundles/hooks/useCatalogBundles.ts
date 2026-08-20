import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { signCatalogProductPhotos } from "../../lib/catalogProductPhoto";
import type { CatalogBundle, CatalogBundleItem, CatalogBundleSave, CatalogBundleSalesTypePrice } from "../types";

export const CATALOG_BUNDLES_QUERY_KEY = "catalog-bundles";

const BUNDLE_SELECT = `
  id, organization_id, name, photo_path, bundle_price, use_sales_type_prices, sort_order, is_active,
  catalog_bundle_items(id, product_id, quantity, sort_order),
  catalog_bundle_outlets(outlet_id),
  catalog_bundle_sales_type_prices(sales_type_id, price)
`;

type BundleRow = Omit<CatalogBundle, "items" | "photo_url" | "outlet_ids" | "sales_type_prices"> & {
  catalog_bundle_items?: Array<{
    id: string;
    product_id: string;
    quantity: number;
    sort_order: number;
  }> | null;
  catalog_bundle_outlets?: Array<{ outlet_id: string }> | null;
  catalog_bundle_sales_type_prices?: Array<{ sales_type_id: string; price: number | string }> | null;
};

function mapRow(row: BundleRow, photoUrl: string | null): CatalogBundle {
  const items = [...(row.catalog_bundle_items ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (item): CatalogBundleItem => ({
        id: item.id,
        product_id: item.product_id,
        quantity: Number(item.quantity) || 1,
      }),
    );
  const sales_type_prices: CatalogBundleSalesTypePrice[] = (row.catalog_bundle_sales_type_prices ?? []).map(
    (link) => {
      const price = Number(link.price);
      return {
        sales_type_id: link.sales_type_id,
        price: Number.isFinite(price) && price >= 0 ? price : 0,
      };
    },
  );
  const rawPrice = Number(row.bundle_price);
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    photo_path: row.photo_path,
    photo_url: photoUrl,
    bundle_price: Number.isFinite(rawPrice) ? rawPrice : 0,
    use_sales_type_prices: Boolean(row.use_sales_type_prices),
    sales_type_prices,
    sort_order: row.sort_order,
    is_active: Boolean(row.is_active),
    items,
    outlet_ids: (row.catalog_bundle_outlets ?? []).map((link) => link.outlet_id),
  };
}

export function useCatalogBundles() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CATALOG_BUNDLES_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogBundle[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_bundles")
        .select(BUNDLE_SELECT)
        .eq("organization_id", organizationId)
        .eq("is_deleted", false)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as BundleRow[];
      const photoMap = await signCatalogProductPhotos(rows.map((row) => row.photo_path ?? ""));
      return rows.map((row) => mapRow(row, row.photo_path ? (photoMap.get(row.photo_path) ?? null) : null));
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [CATALOG_BUNDLES_QUERY_KEY, organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogBundleSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("bundle_name_required");
      if (payload.items.length < 2) throw new Error("bundle_items_min");
      if (payload.outlet_ids.length < 1) throw new Error("bundle_outlets_min");
      const seen = new Set<string>();
      const items = payload.items.map((item) => {
        const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
        if (!item.product_id || seen.has(item.product_id)) throw new Error("bundle_items_invalid");
        seen.add(item.product_id);
        return { product_id: item.product_id, quantity };
      });
      const use_sales_type_prices = Boolean(payload.use_sales_type_prices);
      const uniqueSalesTypePrices = use_sales_type_prices
        ? Array.from(
            new Map(
              payload.sales_type_prices
                .filter((row) => row.sales_type_id)
                .map((row) => [row.sales_type_id, row] as const),
            ).values(),
          )
        : [];
      if (use_sales_type_prices && uniqueSalesTypePrices.length < 1) {
        throw new Error("bundle_sales_type_min");
      }
      for (const row of uniqueSalesTypePrices) {
        const price = Number(row.price);
        if (!Number.isFinite(price) || price < 0) throw new Error("bundle_sales_type_price_required");
      }
      const bundle_price = use_sales_type_prices
        ? Math.min(...uniqueSalesTypePrices.map((row) => Number(row.price)))
        : Number(payload.bundle_price);
      if (!Number.isFinite(bundle_price) || bundle_price < 0) throw new Error("bundle_price_required");

      const fields = {
        name,
        photo_path: payload.photo_path,
        bundle_price,
        use_sales_type_prices,
        is_active: Boolean(payload.is_active),
        is_deleted: false,
      };

      const { data: existingRow, error: existingError } = await supabase
        .from("catalog_bundles")
        .select("id")
        .eq("id", payload.id)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existingRow) {
        const { error } = await supabase.from("catalog_bundles").update(fields).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("catalog_bundles").insert({
          id: payload.id,
          organization_id: organizationId,
          sort_order: (query.data?.length ?? 0) + 1,
          ...fields,
        });
        if (error) throw error;
      }

      const { error: clearError } = await supabase.from("catalog_bundle_items").delete().eq("bundle_id", payload.id);
      if (clearError) throw clearError;
      const { error: itemsError } = await supabase.from("catalog_bundle_items").insert(
        items.map((item, index) => ({
          bundle_id: payload.id,
          organization_id: organizationId,
          product_id: item.product_id,
          quantity: item.quantity,
          sort_order: index + 1,
        })),
      );
      if (itemsError) throw itemsError;

      const uniqueOutletIds = Array.from(new Set(payload.outlet_ids.filter(Boolean)));
      if (uniqueOutletIds.length < 1) throw new Error("bundle_outlets_min");
      const { error: clearOutletsError } = await supabase
        .from("catalog_bundle_outlets")
        .delete()
        .eq("bundle_id", payload.id);
      if (clearOutletsError) throw clearOutletsError;
      const { error: outletsError } = await supabase.from("catalog_bundle_outlets").insert(
        uniqueOutletIds.map((outlet_id) => ({
          bundle_id: payload.id,
          outlet_id,
          organization_id: organizationId,
        })),
      );
      if (outletsError) throw outletsError;

      const { error: clearSalesTypeError } = await supabase
        .from("catalog_bundle_sales_type_prices")
        .delete()
        .eq("bundle_id", payload.id);
      if (clearSalesTypeError) throw clearSalesTypeError;
      if (uniqueSalesTypePrices.length > 0) {
        const { error: salesTypeError } = await supabase.from("catalog_bundle_sales_type_prices").insert(
          uniqueSalesTypePrices.map((row) => ({
            bundle_id: payload.id,
            sales_type_id: row.sales_type_id,
            organization_id: organizationId,
            price: Number(row.price),
          })),
        );
        if (salesTypeError) throw salesTypeError;
      }
      return payload.id;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalog_bundles").update({ is_deleted: true }).eq("id", id);
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
