import { SUPABASE_URL, supabase } from '@/shared/lib/supabaseClient';
import { createStorageDisplayUrl } from '@/shared/lib/storageDisplayUrl';

export const ATTENDANCE_PHOTOS_BUCKET = 'attendance-photos';

const SIGNED_EXPIRES_SEC = 60 * 60;

/** SQL verify / seed paths that were never uploaded to storage — skip signed URL attempts. */
export function isNonStoragePhotoPath(path?: string | null): boolean {
  if (!path?.trim()) return true;
  const trimmed = path.trim().toLowerCase();
  return (
    trimmed === 'verify/photo.jpg' ||
    trimmed.startsWith('verify/') ||
    trimmed === 'photo.jpg'
  );
}

/** Strip bucket prefix or parse Supabase object URL → storage object key. */
export function normalizeAttendancePhotoPath(path?: string | null): string | null {
  if (!path?.trim()) return null;
  const trimmed = path.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (!SUPABASE_URL) return null;
    try {
      const u = new URL(trimmed);
      const projectHost = new URL(SUPABASE_URL).hostname;
      if (u.hostname !== projectHost) return null;

      const match = u.pathname.match(
        /\/storage\/v1\/object\/(?:public|authenticated)\/([^/]+)\/(.+)$/,
      );
      if (match && match[1] === ATTENDANCE_PHOTOS_BUCKET) {
        return decodeURIComponent(match[2]);
      }
    } catch {
      return null;
    }
    return null;
  }

  const withoutBucket = trimmed.replace(/^attendance-photos\//, '');
  return withoutBucket || trimmed;
}

/**
 * Signed URL for private `attendance-photos` bucket.
 * Requires storage RLS: org members via user_organization_ids() (see migration 20260608120000).
 */
export async function getAttendancePhotoDisplayUrl(
  path?: string | null,
  options?: { thumbnail?: boolean },
): Promise<string | null> {
  if (isNonStoragePhotoPath(path)) return null;

  const objectPath = normalizeAttendancePhotoPath(path);
  if (!objectPath) return null;

  const { data: plain, error: plainError } = await supabase.storage
    .from(ATTENDANCE_PHOTOS_BUCKET)
    .createSignedUrl(objectPath, SIGNED_EXPIRES_SEC);

  if (!plainError && plain?.signedUrl) {
    return plain.signedUrl;
  }

  const notFound =
    plainError?.message?.toLowerCase().includes('not found') ||
    plainError?.message?.toLowerCase().includes('object not found');

  if (import.meta.env.DEV && plainError && !notFound) {
    console.warn('[attendance-photo] createSignedUrl failed:', plainError.message, objectPath);
  }

  if (options?.thumbnail === false) {
    return null;
  }

  const withTransform = await createStorageDisplayUrl(ATTENDANCE_PHOTOS_BUCKET, objectPath, {
    expiresIn: SIGNED_EXPIRES_SEC,
    transform: { width: 256, quality: 85, resize: 'cover' },
  });

  return withTransform;
}
