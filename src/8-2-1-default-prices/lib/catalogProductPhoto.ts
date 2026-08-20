import { supabase } from '@/shared/lib/supabaseClient';

export const CATALOG_PRODUCT_PHOTOS_BUCKET = 'catalog-product-photos';

export function catalogProductPhotoObjectPath(organizationId: string, productId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'photo.jpg';
  return `${organizationId}/${productId}/${safe}`;
}

export async function uploadCatalogProductPhoto(args: {
  organizationId: string;
  productId: string;
  file: File;
}): Promise<string> {
  const path = catalogProductPhotoObjectPath(args.organizationId, args.productId, args.file.name);
  const { error } = await supabase.storage.from(CATALOG_PRODUCT_PHOTOS_BUCKET).upload(path, args.file, {
    upsert: true,
    contentType: args.file.type || 'image/jpeg',
  });
  if (error) throw error;
  return path;
}

export function catalogBundlePhotoObjectPath(organizationId: string, bundleId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'photo.jpg';
  return `${organizationId}/bundles/${bundleId}/${safe}`;
}

export async function uploadCatalogBundlePhoto(args: {
  organizationId: string;
  bundleId: string;
  file: File;
}): Promise<string> {
  const path = catalogBundlePhotoObjectPath(args.organizationId, args.bundleId, args.file.name);
  const { error } = await supabase.storage.from(CATALOG_PRODUCT_PHOTOS_BUCKET).upload(path, args.file, {
    upsert: true,
    contentType: args.file.type || 'image/jpeg',
  });
  if (error) throw error;
  return path;
}

export async function signCatalogProductPhotos(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data, error } = await supabase.storage
    .from(CATALOG_PRODUCT_PHOTOS_BUCKET)
    .createSignedUrls(unique, 60 * 60);
  if (error) {
    console.error('signCatalogProductPhotos', error);
    return map;
  }
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}
