import { supabase } from "@/shared/lib/supabaseClient";

export const SUB_SERVICE_PHOTOS_BUCKET = "sub-service-photos";

const MAX_BYTES = 5 * 1024 * 1024;

const MIME_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function subServicePhotoError(file: File): string | null {
  const extension = MIME_EXTENSION[file.type];
  if (!extension) return "Use a PNG, JPEG, WebP, or GIF image.";
  if (file.size > MAX_BYTES) return "Image must be 5 MB or smaller.";
  return null;
}

export function clipboardImageFile(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of data.items) {
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (!file) continue;
    const extension = MIME_EXTENSION[file.type];
    if (!extension) continue;
    if (file.name) return file;
    return new File([file], `pasted.${extension}`, { type: file.type });
  }
  return null;
}

function objectPath(organizationId: string, subServiceId: string, file: File): string {
  const extension = MIME_EXTENSION[file.type] ?? "jpg";
  return `${organizationId}/${subServiceId}.${extension}`;
}

export async function uploadSubServicePhoto(args: {
  organizationId: string;
  subServiceId: string;
  file: File;
}): Promise<string> {
  const invalid = subServicePhotoError(args.file);
  if (invalid) throw new Error(invalid);
  const path = objectPath(args.organizationId, args.subServiceId, args.file);
  const { error } = await supabase.storage.from(SUB_SERVICE_PHOTOS_BUCKET).upload(path, args.file, {
    upsert: true,
    contentType: args.file.type,
  });
  if (error) throw error;
  return path;
}

export async function removeSubServicePhoto(path: string | null | undefined): Promise<void> {
  const cleaned = path?.trim();
  if (!cleaned) return;
  const { error } = await supabase.storage.from(SUB_SERVICE_PHOTOS_BUCKET).remove([cleaned]);
  if (error) throw error;
}

export async function setSubServiceImagePath(id: string, imagePath: string | null): Promise<void> {
  const { error } = await supabase
    .from("sub_services")
    .update({ image_path: imagePath, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function signSubServicePhotos(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase.storage
    .from(SUB_SERVICE_PHOTOS_BUCKET)
    .createSignedUrls(unique, 60 * 60);
  if (error) {
    console.error("signSubServicePhotos", error);
    return map;
  }
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}
