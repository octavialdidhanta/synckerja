import {
  extractGoogleDriveFileId,
  isFileLink,
  isFolderLink,
} from '@/6-1-dashboard/utils/previewUtils';

export function validateGoogleDriveVideoLink(url: string | null | undefined): {
  valid: boolean;
  error?: string;
} {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) return { valid: false, error: 'Google Drive link is required' };
  if (isFolderLink(trimmed)) {
    return { valid: false, error: 'Link must be a video file, not a folder' };
  }
  if (!isFileLink(trimmed)) {
    return { valid: false, error: 'Invalid Google Drive file link' };
  }
  if (!extractGoogleDriveFileId(trimmed)) {
    return { valid: false, error: 'Could not parse Google Drive file ID' };
  }
  return { valid: true };
}
