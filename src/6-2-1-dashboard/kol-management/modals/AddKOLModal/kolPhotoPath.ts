export const KOL_PHOTO_BUCKET = "kol-profile-photos";

/** Storage path inside the bucket from a public URL (…/object/public/kol-profile-photos/<path>). */
export function kolPhotoPathFromUrl(publicUrl: string): string | null {
  try {
    const marker = `/${KOL_PHOTO_BUCKET}/`;
    const pathname = decodeURIComponent(new URL(publicUrl).pathname);
    const at = pathname.indexOf(marker);
    return at >= 0 ? pathname.slice(at + marker.length) || null : null;
  } catch {
    return null;
  }
}
