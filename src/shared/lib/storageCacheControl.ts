/** Max-age (seconds) for public storage objects — logos, avatars, static uploads. */
export const STORAGE_OBJECT_CACHE_CONTROL = "31536000";

export function storageUploadOptions(options?: {
  upsert?: boolean;
  contentType?: string;
}): { cacheControl: string; upsert?: boolean; contentType?: string } {
  return {
    cacheControl: STORAGE_OBJECT_CACHE_CONTROL,
    ...options,
  };
}
