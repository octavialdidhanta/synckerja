import { ShareIntent } from '@/plugins/share-intent';
import {
  ensureVideoFileName,
  MIN_SHARE_VIDEO_BYTES,
  validateVideoContainerHeader,
} from '@/shared/lib/validateVideoContainerHeader';

const HEADER_SCAN_BYTES = 512;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isMissingNativePluginError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('not implemented') ||
    msg.includes('unimplemented') ||
    msg.includes('getfilestat') ||
    msg.includes('does not have method')
  );
}

async function resolveNativeFileSize(path: string, fallbackSize?: number): Promise<number> {
  try {
    const stat = await ShareIntent.getFileStat({ path });
    if (stat.size > 0) return stat.size;
  } catch (e) {
    if (!isMissingNativePluginError(e)) throw e;
  }

  if (typeof fallbackSize === 'number' && fallbackSize > 0) return fallbackSize;

  throw new Error(
    'drive_upload_failed: could not determine video file size. Rebuild the app, then share again.',
  );
}

/**
 * Resolve accurate byte size + container-validated MIME/name from the native cache file.
 * Falls back to share payload size when getFileStat is unavailable (old native build).
 */
export async function normalizeNativeVideoUploadMeta(args: {
  path: string;
  name: string;
  mimeType: string;
  fallbackSize?: number;
}): Promise<{ path: string; name: string; mimeType: string; size: number }> {
  const size = await resolveNativeFileSize(args.path, args.fallbackSize);
  if (!size || size < MIN_SHARE_VIDEO_BYTES) {
    throw new Error(
      `invalid_video_file: file too small (${size} bytes). Share the video again from CapCut/Edits.`,
    );
  }

  const header = await ShareIntent.readFileChunk({
    path: args.path,
    offset: 0,
    length: HEADER_SCAN_BYTES,
  });
  if (!header.bytesRead || !header.data) {
    throw new Error('invalid_video_file: could not read video header');
  }

  let mimeType = args.mimeType?.trim() || 'video/mp4';
  let name = args.name;

  try {
    const validated = validateVideoContainerHeader(base64ToBytes(header.data));
    mimeType = validated.mimeType;
    name = ensureVideoFileName(args.name, mimeType);
  } catch (headerErr) {
    const hint = args.mimeType?.toLowerCase().startsWith('video/') ? args.mimeType : 'video/mp4';
    if (size >= MIN_SHARE_VIDEO_BYTES) {
      mimeType = hint;
      name = ensureVideoFileName(args.name, mimeType);
    } else {
      throw headerErr;
    }
  }

  return {
    path: args.path,
    name,
    mimeType,
    size,
  };
}
