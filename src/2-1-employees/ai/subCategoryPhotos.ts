import { useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { signCatalogProductPhotos } from "@/8-2-1-default-prices/lib/catalogProductPhoto";

type SubRow = {
  id: string;
  name: string | null;
  catalog_product_id: string | null;
};

function photoPath(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function pathForUniqueName(organizationId: string, name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("default_prices")
    .select("id, photo_path")
    .eq("organization_id", organizationId)
    .eq("kind", "product")
    .ilike("name", name);
  if (error || !data || data.length !== 1) return null;
  const path = photoPath(data[0]?.photo_path);
  return path || null;
}

async function loadSubCategoryPhotoUrls(organizationId: string, ids: string[]): Promise<Record<string, string>> {
  const { data: subs, error } = await supabase
    .from("sub_services")
    .select("id, name, catalog_product_id")
    .eq("organization_id", organizationId)
    .in("id", ids);
  if (error || !subs) return {};

  const rows = subs as SubRow[];
  const linkedIds = [...new Set(rows.map((row) => row.catalog_product_id).filter((id): id is string => Boolean(id)))];
  const pathBySub = new Map<string, string>();

  if (linkedIds.length > 0) {
    const { data: products } = await supabase
      .from("default_prices")
      .select("id, photo_path")
      .in("id", linkedIds);
    const byId = new Map<string, string>();
    for (const product of products ?? []) {
      const path = photoPath(product.photo_path);
      if (product.id && path) byId.set(product.id, path);
    }
    for (const row of rows) {
      if (!row.catalog_product_id) continue;
      const path = byId.get(row.catalog_product_id);
      if (path) pathBySub.set(row.id, path);
    }
  }

  const unmatched = rows.filter((row) => !pathBySub.has(row.id) && row.name?.trim());
  if (unmatched.length > 0) {
    const byName = new Map<string, string | null>();
    await Promise.all(unmatched.map(async (row) => {
      const name = row.name?.trim() ?? "";
      const key = name.toLowerCase();
      if (!byName.has(key)) byName.set(key, await pathForUniqueName(organizationId, name));
    }));
    for (const row of unmatched) {
      const path = byName.get(row.name?.trim().toLowerCase() ?? "");
      if (path) pathBySub.set(row.id, path);
    }
  }

  const signed = await signCatalogProductPhotos([...pathBySub.values()]);
  const urls: Record<string, string> = {};
  for (const [id, path] of pathBySub) {
    const url = signed.get(path);
    if (url) urls[id] = url;
  }
  return urls;
}

export function useSubCategoryPhotoUrls(organizationId: string, ids: string[]): Record<string, string> {
  const key = [...ids].sort().join(",");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const idList = key ? key.split(",") : [];
    if (!organizationId || idList.length === 0) {
      setUrls({});
      return;
    }
    let cancelled = false;
    void loadSubCategoryPhotoUrls(organizationId, idList).then((next) => {
      if (!cancelled) setUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, key]);

  return urls;
}
