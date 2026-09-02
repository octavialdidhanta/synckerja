import { supabase } from "@/shared/lib/supabaseClient";
import { resolveCatalogPhotoUrls } from "@/synckerja-order/shared/lib/orderStorePhoto";
import { normalizePublicCode } from "./publicCode";
import type { PublicOrderCatalog, PublicOrderItemOptions, PublicOrderStore } from "./orderTypes";

const EMPTY_CATALOG: PublicOrderCatalog = {
  ok: false,
  error: "not_found",
  categories: [],
  items: [],
  dine_in_sales_type_id: null,
  dine_in_sales_type_label: "Dine In",
};

export async function fetchPublicOrderStore(args: {
  code: string;
  tableNumber?: string | null;
}): Promise<PublicOrderStore> {
  const code = normalizePublicCode(args.code);
  const { data, error } = await supabase.rpc("get_public_synckerja_order_store", {
    p_code: code,
    p_table_name: args.tableNumber?.trim() || null,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const store = (data ?? { ok: false, error: "not_found" }) as PublicOrderStore;
  if (!store.ok) return store;
  const photos = await resolveCatalogPhotoUrls([store.cover_path, store.logo_path]);
  return {
    ...store,
    cover_url: store.cover_path ? photos.get(store.cover_path) ?? null : null,
  };
}

export async function fetchPublicOrderCatalog(code: string): Promise<PublicOrderCatalog> {
  const { data, error } = await supabase.rpc("get_public_synckerja_order_catalog", {
    p_code: normalizePublicCode(code),
  });
  if (error) {
    return { ...EMPTY_CATALOG, error: error.message };
  }
  const catalog = (data ?? EMPTY_CATALOG) as PublicOrderCatalog;
  const photos = await resolveCatalogPhotoUrls(catalog.items.map((item) => item.photo_path));
  return {
    ...catalog,
    items: catalog.items.map((item) => ({
      ...item,
      photo_url: item.photo_path ? photos.get(item.photo_path) ?? null : null,
    })),
  };
}

export async function fetchPublicOrderItemOptions(args: {
  code: string;
  itemId: string;
}): Promise<PublicOrderItemOptions> {
  const empty: PublicOrderItemOptions = {
    ok: false,
    error: "not_found",
    kind: "product",
    id: args.itemId,
    name: "",
    description: null,
    unit_price: 0,
    photo_path: null,
    variants: [],
    modifier_groups: [],
    included_items: [],
  };
  const { data, error } = await supabase.rpc("get_public_synckerja_order_item_options", {
    p_code: normalizePublicCode(args.code),
    p_item_id: args.itemId,
  });
  if (error) return { ...empty, error: error.message };
  const payload = (data ?? empty) as PublicOrderItemOptions;
  if (!payload.ok) return payload;
  const photos = await resolveCatalogPhotoUrls([payload.photo_path]);
  return {
    ...payload,
    photo_url: payload.photo_path ? photos.get(payload.photo_path) ?? null : null,
    variants: payload.variants ?? [],
    modifier_groups: payload.modifier_groups ?? [],
    included_items: payload.included_items ?? [],
  };
}
