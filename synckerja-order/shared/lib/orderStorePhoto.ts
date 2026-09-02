import { CATALOG_PRODUCT_PHOTOS_BUCKET, signCatalogProductPhotos } from "@/8-2-1-default-prices/lib/catalogProductPhoto";
import { supabase } from "@/shared/lib/supabaseClient";

export function synckerjaOrderCoverObjectPath(organizationId: string, fileName: string): string {
  const ext = (fileName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${organizationId}/synckerja-order/cover.${ext}`;
}

export async function uploadSynckerjaOrderCover(args: {
  organizationId: string;
  file: File;
}): Promise<string> {
  const path = synckerjaOrderCoverObjectPath(args.organizationId, args.file.name);
  const { error } = await supabase.storage.from(CATALOG_PRODUCT_PHOTOS_BUCKET).upload(path, args.file, {
    upsert: true,
    contentType: args.file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

export function publicCatalogPhotoUrl(path: string | null | undefined): string | null {
  const trimmed = (path ?? "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

export function normalizeCatalogStoragePath(path: string | null | undefined): string {
  return String(path ?? "").trim().replace(/^\/+/, "");
}

export async function resolveCatalogPhotoUrls(paths: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(paths.map(normalizeCatalogStoragePath).filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const remote: string[] = [];
  for (const path of unique) {
    if (/^https?:\/\//i.test(path)) {
      map.set(path, path);
      continue;
    }
    remote.push(path);
  }
  if (remote.length === 0) return map;
  const signed = await signCatalogProductPhotos(remote);
  for (const path of remote) {
    const url = signed.get(path);
    if (url) map.set(path, url);
  }
  return map;
}

/** Storefront: sign menu photos for guests; falls back to edge function when anon storage signing fails. */
export async function resolvePublicOrderPhotoUrls(
  publicCode: string,
  paths: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const map = await resolveCatalogPhotoUrls(paths);
  const code = publicCode.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!code) return map;

  const missing = [...new Set(paths.map(normalizeCatalogStoragePath).filter(Boolean))].filter(
    (path) => !map.has(path),
  );
  if (missing.length === 0) return map;

  try {
    const { data, error } = await supabase.functions.invoke<{ urls?: Record<string, string> }>(
      "sign-synckerja-order-photos",
      { body: { code, paths: missing } },
    );
    if (error) {
      console.warn("resolvePublicOrderPhotoUrls", error);
      return map;
    }
    for (const [path, url] of Object.entries(data?.urls ?? {})) {
      const normalized = normalizeCatalogStoragePath(path);
      if (normalized && url) map.set(normalized, url);
    }
  } catch (err) {
    console.warn("resolvePublicOrderPhotoUrls", err);
  }
  return map;
}
