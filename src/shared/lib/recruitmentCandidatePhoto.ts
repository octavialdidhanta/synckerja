import { createStorageDisplayUrl } from '@/shared/lib/storageDisplayUrl';

export const RECRUITMENT_FILES_BUCKET = 'recruitment-files';

/** Normalize storage path for any object in `recruitment-files` (documents, photos, etc.). */
export function normalizeRecruitmentFilesPath(stored: string | null | undefined): string {
  return normalizeRecruitmentPhotoPath(stored);
}

/** Normalize `candidate_profiles.photo_url` (path, public URL, or bucket-prefixed path). */
export function normalizeRecruitmentPhotoPath(stored: string | null | undefined): string {
  const trimmed = String(stored ?? '').trim();
  if (!trimmed) return '';

  const publicMarker = `/storage/v1/object/public/${RECRUITMENT_FILES_BUCKET}/`;
  if (trimmed.includes(publicMarker)) {
    const idx = trimmed.indexOf(publicMarker);
    const pathPart = trimmed.slice(idx + publicMarker.length).split('?')[0];
    try {
      return decodeURIComponent(pathPart);
    } catch {
      return pathPart;
    }
  }

  const signedMarker = `/storage/v1/object/sign/${RECRUITMENT_FILES_BUCKET}/`;
  if (trimmed.includes(signedMarker)) {
    const idx = trimmed.indexOf(signedMarker);
    const pathPart = trimmed.slice(idx + signedMarker.length).split('?')[0];
    try {
      return decodeURIComponent(pathPart);
    } catch {
      return pathPart;
    }
  }

  if (trimmed.startsWith(`${RECRUITMENT_FILES_BUCKET}/`)) {
    return trimmed.slice(`${RECRUITMENT_FILES_BUCKET}/`.length);
  }

  return trimmed;
}

/**
 * Resolve stored photo value to a browser-loadable URL (signed URL for private bucket).
 */
export async function resolveRecruitmentCandidatePhotoDisplayUrl(
  stored: string | null | undefined,
  options?: { expiresIn?: number; width?: number },
): Promise<string | null> {
  const raw = normalizeRecruitmentPhotoPath(stored);
  if (!raw) return null;

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const nested = normalizeRecruitmentPhotoPath(raw);
    if (nested && nested !== raw && !nested.startsWith('http')) {
      return resolveRecruitmentCandidatePhotoDisplayUrl(nested, options);
    }
    return raw;
  }

  const expiresIn = options?.expiresIn ?? 60 * 60;
  const width = options?.width ?? 256;

  const withTransform = await createStorageDisplayUrl(RECRUITMENT_FILES_BUCKET, raw, {
    expiresIn,
    transform: { width, resize: 'contain', quality: 80 },
  });
  if (withTransform) return withTransform;

  return createStorageDisplayUrl(RECRUITMENT_FILES_BUCKET, raw, { expiresIn });
}
