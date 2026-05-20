import { supabase } from "@/shared/lib/supabaseClient";

export type StorageImageTransform = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

const DEFAULT_SIGNED_EXPIRES_SEC = 60 * 60 * 24;

/**
 * Signed URL for private buckets with optional image transform (smaller transfer + CDN cache).
 */
export async function createStorageDisplayUrl(
  bucket: string,
  path: string,
  options?: {
    expiresIn?: number;
    transform?: StorageImageTransform;
  },
): Promise<string | null> {
  const trimmed = path.trim();
  if (!trimmed) return null;

  const expiresIn = options?.expiresIn ?? DEFAULT_SIGNED_EXPIRES_SEC;
  const transform = options?.transform;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(
    trimmed,
    expiresIn,
    transform ? { transform } : undefined,
  );

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Public object URL → Supabase image render endpoint (WebP + resize). Falls back to original on parse failure.
 */
export function optimizePublicStorageImageUrl(
  publicUrl: string | null | undefined,
  transform?: StorageImageTransform,
): string | null {
  if (!publicUrl?.trim()) return null;
  if (!publicUrl.includes("/storage/v1/object/public/")) return publicUrl;

  const width = transform?.width ?? 256;
  const quality = transform?.quality ?? 80;

  try {
    const renderUrl = publicUrl.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/",
    );
    const u = new URL(renderUrl);
    u.searchParams.set("width", String(width));
    if (transform?.height) u.searchParams.set("height", String(transform.height));
    u.searchParams.set("quality", String(quality));
    u.searchParams.set("format", "webp");
    if (transform?.resize) u.searchParams.set("resize", transform.resize);
    return u.toString();
  } catch {
    return publicUrl;
  }
}

/** Avatar / list thumb widths by UI size. */
export function avatarDisplayWidth(size: "sm" | "md" | "md-lg" | "lg" | "xl"): number {
  switch (size) {
    case "sm":
      return 64;
    case "md":
      return 80;
    case "md-lg":
      return 96;
    case "lg":
      return 128;
    case "xl":
      return 192;
    default:
      return 80;
  }
}
