import { supabase } from '@/shared/lib/supabaseClient';
import { createStorageDisplayUrl } from '@/shared/lib/storageDisplayUrl';
import {
  ATTENDANCE_PHOTOS_BUCKET,
  getAttendancePhotoDisplayUrl,
  isNonStoragePhotoPath,
  normalizeAttendancePhotoPath,
} from '@/2-3-employee-attendance/utils/attendancePhotoUrl';

const SIGNED_EXPIRES_SEC = 60 * 60;

export type ClientVisitPhotoUrlOptions = {
  thumbnail?: boolean;
  /** Helps resolve legacy `visits/{userId}/…` paths to `{employeeId}/…` candidates. */
  employeeId?: string | null;
};

function uniqueCandidates(candidates: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/** Legacy mobile paths: `visits/{userId}/{timestamp}_{start|end}.jpg` */
export function buildClientVisitPhotoObjectCandidates(
  path?: string | null,
  employeeId?: string | null,
): string[] {
  if (!path?.trim()) return [];

  const trimmed = path.trim();
  const attendancePath = normalizeAttendancePhotoPath(trimmed);
  const fileName = trimmed.includes('/') ? trimmed.split('/').pop() ?? trimmed : trimmed;

  if (trimmed.startsWith('visits/')) {
    const withoutPrefix = trimmed.replace(/^visits\//, '');
    const legacyUserId = withoutPrefix.includes('/')
      ? withoutPrefix.split('/')[0]
      : null;

    return uniqueCandidates([
      trimmed,
      withoutPrefix,
      employeeId && fileName ? `${employeeId}/${fileName}` : null,
      employeeId && withoutPrefix ? `${employeeId}/${withoutPrefix.split('/').pop()}` : null,
      legacyUserId && fileName ? `${legacyUserId}/${fileName}` : null,
    ]);
  }

  if (attendancePath) {
    return uniqueCandidates([
      attendancePath,
      employeeId && fileName && !attendancePath.startsWith(`${employeeId}/`)
        ? `${employeeId}/${fileName}`
        : null,
    ]);
  }

  return uniqueCandidates([trimmed, employeeId && fileName ? `${employeeId}/${fileName}` : null]);
}

async function trySignObjectPath(
  objectPath: string,
  options?: ClientVisitPhotoUrlOptions,
): Promise<string | null> {
  const { data: plain, error: plainError } = await supabase.storage
    .from(ATTENDANCE_PHOTOS_BUCKET)
    .createSignedUrl(objectPath, SIGNED_EXPIRES_SEC);

  if (!plainError && plain?.signedUrl) {
    return plain.signedUrl;
  }

  if (options?.thumbnail === false) {
    return null;
  }

  return createStorageDisplayUrl(ATTENDANCE_PHOTOS_BUCKET, objectPath, {
    expiresIn: SIGNED_EXPIRES_SEC,
    transform: { width: 256, quality: 85, resize: 'cover' },
  });
}

async function trySignClientVisitPhotoPaths(
  candidates: string[],
  options?: ClientVisitPhotoUrlOptions,
): Promise<string | null> {
  for (const objectPath of candidates) {
    const signed = await trySignObjectPath(objectPath, options);
    if (signed) return signed;
  }
  return null;
}

/**
 * Signed URL for client visit start/end photos.
 * Supports employee-folder paths (same as attendance) and legacy `visits/` paths.
 */
export async function getClientVisitPhotoDisplayUrl(
  path?: string | null,
  options?: ClientVisitPhotoUrlOptions,
): Promise<string | null> {
  if (!path?.trim() || isNonStoragePhotoPath(path)) return null;

  const trimmed = path.trim();

  // Standard attendance-style paths (`{employeeId}/visit_start_*.jpg`, check-in paths, etc.)
  if (!trimmed.startsWith('visits/')) {
    const attendanceSigned = await getAttendancePhotoDisplayUrl(trimmed, options);
    if (attendanceSigned) return attendanceSigned;

    const fallbackCandidates = buildClientVisitPhotoObjectCandidates(trimmed, options?.employeeId);
    return trySignClientVisitPhotoPaths(fallbackCandidates, options);
  }

  // Legacy `visits/{userId}/…` — must not pass through attendance normalizer (keeps `visits/` prefix).
  const legacyCandidates = buildClientVisitPhotoObjectCandidates(trimmed, options?.employeeId);
  return trySignClientVisitPhotoPaths(legacyCandidates, options);
}

/** Resolve storage object key for debugging / fallbacks. */
export function resolveClientVisitPhotoObjectPath(
  path?: string | null,
  employeeId?: string | null,
): string | null {
  return buildClientVisitPhotoObjectCandidates(path, employeeId)[0] ?? null;
}
