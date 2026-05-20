import { useQuery } from "@tanstack/react-query";
import { createStorageDisplayUrl, type StorageImageTransform } from "@/shared/lib/storageDisplayUrl";

type Options = {
  bucket: string;
  path: string | null | undefined;
  enabled?: boolean;
  expiresIn?: number;
  transform?: StorageImageTransform;
};

/**
 * Cached signed display URL (dedupes parallel requests for the same object — fixes triple 934KB logo fetches).
 */
export function useStorageSignedImageUrl({
  bucket,
  path,
  enabled = true,
  expiresIn,
  transform,
}: Options) {
  const normalized = path?.trim() ?? "";
  const transformKey = transform
    ? `${transform.width ?? ""}-${transform.height ?? ""}-${transform.quality ?? ""}-${transform.resize ?? ""}`
    : "raw";

  return useQuery({
    queryKey: ["storage-signed-url", bucket, normalized, transformKey, expiresIn ?? "default"],
    queryFn: () => createStorageDisplayUrl(bucket, normalized, { expiresIn, transform }),
    enabled: enabled && normalized.length > 0,
    staleTime: 1000 * 60 * 50,
    gcTime: 1000 * 60 * 55,
  });
}
