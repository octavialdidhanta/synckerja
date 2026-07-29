/** Client-side video container check — keep in sync with edge validateDownloadedVideo.ts */
const MIN_VIDEO_BYTES = 10 * 1024;
const HEADER_SCAN_BYTES = 512;

const MP4_FTYP_BRANDS = new Set([
  'isom',
  'iso2',
  'mp41',
  'mp42',
  'avc1',
  'M4V ',
  'M4A ',
  'qt  ',
]);

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return new TextDecoder().decode(bytes.subarray(offset, offset + length));
}

/** Scan header for ISO BMFF `ftyp` (CapCut may prepend skip/free atoms). */
function findFtypOffset(bytes: Uint8Array): number | null {
  const limit = Math.min(bytes.byteLength - 8, HEADER_SCAN_BYTES);
  for (let i = 0; i <= limit; i++) {
    if (readAscii(bytes, i, 4) === 'ftyp') return i;
  }
  return null;
}

function isWebmHeader(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
}

export function detectMp4OrMovMimeType(bytes: Uint8Array): string | null {
  const ftypAt = findFtypOffset(bytes);
  if (ftypAt === null) return null;

  const brandOffset = ftypAt + 4;
  if (brandOffset + 4 > bytes.byteLength) return 'video/mp4';

  const majorBrand = readAscii(bytes, brandOffset, 4);
  if (MP4_FTYP_BRANDS.has(majorBrand)) {
    return majorBrand.trim() === 'qt' ? 'video/quicktime' : 'video/mp4';
  }

  return 'video/mp4';
}

export function detectVideoContainerMimeType(bytes: Uint8Array): string | null {
  const mp4 = detectMp4OrMovMimeType(bytes);
  if (mp4) return mp4;
  if (isWebmHeader(bytes)) return 'video/webm';
  return null;
}

export function validateVideoContainerHeader(bytes: Uint8Array): { mimeType: string } {
  const detected = detectVideoContainerMimeType(bytes);
  if (!detected) {
    throw new Error(
      'invalid_video_file: not a valid MP4/MOV container. Re-export as MP4 from CapCut/Edits and share again.',
    );
  }
  return { mimeType: detected };
}

export function extensionForVideoMime(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m === 'video/quicktime') return '.mov';
  if (m === 'video/webm') return '.webm';
  return '.mp4';
}

/** Ensure Drive receives a filename extension that matches the container MIME. */
export function ensureVideoFileName(name: string, mimeType: string): string {
  const trimmed = String(name ?? '').trim() || 'shared-video.mp4';
  const ext = extensionForVideoMime(mimeType);
  const lower = trimmed.toLowerCase();
  if (
    lower.endsWith('.mp4') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.m4v')
  ) {
    return trimmed;
  }
  if (!trimmed.includes('.')) {
    return `${trimmed}${ext}`;
  }
  return `${trimmed}${ext}`;
}

export const MIN_SHARE_VIDEO_BYTES = MIN_VIDEO_BYTES;
