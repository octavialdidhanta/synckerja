import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { signCatalogProductPhotos } from "@/8-2-1-default-prices/lib/catalogProductPhoto";
import { isOrderCatalogEligible } from "@/synckerja-order/shared/lib/orderCatalogPublish";

export const SYNCKERJA_ORDER_CATALOG_QUERY = "synckerja-order-catalog";

export type SynckerjaOrderCatalogRow = {
  id: string;
  kind: "product" | "bundle";
  name: string;
  description: string | null;
  unit_price: number;
  photo_url: string | null;
  product_category_id: string | null;
  product_category_name: string | null;
  product_category_sort: number | null;
  opted_in: boolean;
};

type CatalogOutletLink = { outlet_id: string; pos_status: string | null };

export function useSynckerjaOrderCatalog(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [SYNCKERJA_ORDER_CATALOG_QUERY, organizationId, outletId],
    queryFn: async (): Promise<SynckerjaOrderCatalogRow[]> => {
      if (!organizationId || !outletId) return [];
      const { data: prices, error } = await supabase
        .from("default_prices")
        .select(
          "id, name, description, unit_price, photo_path, product_category_id, kind, pos_status, catalog_product_outlets(outlet_id, pos_status)",
        )
        .eq("organization_id", organizationId)
        .eq("kind", "product")
        .neq("pos_status", "hidden")
        .order("name", { ascending: true });
      if (error) throw error;
      const assigned = (prices ?? []).filter((row) => {
        const links = (row.catalog_product_outlets ?? []) as CatalogOutletLink[];
        const assignedIds = links.map((link) => String(link.outlet_id));
        const outletLink = links.find((link) => String(link.outlet_id) === outletId);
        return isOrderCatalogEligible({
          outletId,
          assignedOutletIds: assignedIds,
          masterPosStatus: row.pos_status ? String(row.pos_status) : null,
          outletPosStatus: outletLink?.pos_status ?? null,
        });
      });
      const categoryIds = [
        ...new Set(assigned.map((p) => p.product_category_id).filter(Boolean)),
      ] as string[];
      const [{ data: cats }, { data: optIns }, { data: bundles }, photoMap] = await Promise.all([
        categoryIds.length
          ? supabase
              .from("catalog_product_categories")
              .select("id, name, sort_order")
              .in("id", categoryIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string; sort_order: number }> }),
        supabase
          .from("synckerja_order_catalog_items")
          .select("catalog_item_id, bundle_id")
          .eq("outlet_id", outletId),
        supabase
          .from("catalog_bundles")
          .select("id, name, photo_path, bundle_price, is_active, is_deleted, catalog_bundle_outlets(outlet_id)")
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .eq("is_deleted", false)
          .order("name", { ascending: true }),
        signCatalogProductPhotos([
          ...assigned.map((p) => String(p.photo_path ?? "")),
        ]),
      ]);
      const assignedBundles = (bundles ?? []).filter((row) => {
        const links = (row.catalog_bundle_outlets ?? []) as Array<{ outlet_id: string }>;
        return links.some((link) => String(link.outlet_id) === outletId);
      });
      const bundlePhotos = await signCatalogProductPhotos(
        assignedBundles.map((b) => String(b.photo_path ?? "")),
      );
      const catNames = new Map((cats ?? []).map((c) => [c.id, c.name]));
      const catSort = new Map((cats ?? []).map((c) => [c.id, Number(c.sort_order ?? 0)]));
      const optedProducts = new Set(
        (optIns ?? []).map((r) => r.catalog_item_id).filter(Boolean).map((id) => String(id)),
      );
      const optedBundles = new Set(
        (optIns ?? []).map((r) => r.bundle_id).filter(Boolean).map((id) => String(id)),
      );
      const productRows: SynckerjaOrderCatalogRow[] = assigned.map((row) => ({
        id: String(row.id),
        kind: "product",
        name: String(row.name ?? ""),
        description: row.description ? String(row.description) : null,
        unit_price: Number(row.unit_price ?? 0),
        photo_url: row.photo_path ? photoMap.get(String(row.photo_path)) ?? null : null,
        product_category_id: row.product_category_id ? String(row.product_category_id) : null,
        product_category_name: row.product_category_id
          ? catNames.get(String(row.product_category_id)) ?? null
          : null,
        product_category_sort: row.product_category_id
          ? catSort.get(String(row.product_category_id)) ?? 0
          : null,
        opted_in: optedProducts.has(String(row.id)),
      }));
      const bundleRows: SynckerjaOrderCatalogRow[] = assignedBundles.map((row) => ({
        id: String(row.id),
        kind: "bundle",
        name: String(row.name ?? ""),
        description: null,
        unit_price: Number(row.bundle_price ?? 0),
        photo_url: row.photo_path ? bundlePhotos.get(String(row.photo_path)) ?? null : null,
        product_category_id: null,
        product_category_name: null,
        product_category_sort: null,
        opted_in: optedBundles.has(String(row.id)),
      }));
      return [...productRows, ...bundleRows];
    },
    enabled: Boolean(organizationId && outletId),
  });

  const toggle = useMutation({
    mutationFn: async (args: {
      catalogItemId: string;
      optedIn: boolean;
      kind?: "product" | "bundle";
    }) => {
      if (!organizationId || !outletId) throw new Error("outlet_required");
      const kind = args.kind ?? "product";
      if (args.optedIn) {
        const payload =
          kind === "bundle"
            ? {
                organization_id: organizationId,
                outlet_id: outletId,
                catalog_item_id: null,
                bundle_id: args.catalogItemId,
              }
            : {
                organization_id: organizationId,
                outlet_id: outletId,
                catalog_item_id: args.catalogItemId,
                bundle_id: null,
              };
        const { error } = await supabase.from("synckerja_order_catalog_items").insert(payload);
        if (error && !/duplicate/i.test(error.message)) throw error;
        return;
      }
      const q = supabase.from("synckerja_order_catalog_items").delete().eq("outlet_id", outletId);
      const { error } =
        kind === "bundle"
          ? await q.eq("bundle_id", args.catalogItemId)
          : await q.eq("catalog_item_id", args.catalogItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [SYNCKERJA_ORDER_CATALOG_QUERY, organizationId, outletId],
      });
    },
  });

  return { ...query, rows: query.data ?? [], toggle };
}
