const BUCKET = "employee-profiles";

function baseUrl(): string {
  return String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
}

/** Public URL for an object path inside `employee-profiles`. */
export function getPublicPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const root = baseUrl();
  if (!root) return null;
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${root}/storage/v1/object/public/${BUCKET}/${encoded}`;
}

/** If `url` is our public URL for this bucket, return storage object path; else null. */
export function publicUrlToObjectPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const root = baseUrl();
  if (!root) return null;
  const prefix = `${root}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(url.slice(prefix.length));
  } catch {
    return url.slice(prefix.length);
  }
}

/** Resolve stored `profiles.profile_photo_url` (path or public URL) to a displayable image URL. */
export function resolveProfilePhotoDisplayUrl(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return null;
  const pathFromUrl = publicUrlToObjectPath(stored);
  return pathFromUrl ? getPublicPhotoUrl(pathFromUrl) : getPublicPhotoUrl(stored);
}

export { BUCKET as PROFILE_PHOTO_BUCKET };
