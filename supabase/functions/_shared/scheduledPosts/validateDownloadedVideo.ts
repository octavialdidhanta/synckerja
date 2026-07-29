const MIN_VIDEO_BYTES = 10 * 1024;

const MP4_FTYP_BRANDS = new Set([
  "isom",
  "iso2",
  "mp41",
  "mp42",
  "avc1",
  "M4V ",
  "M4A ",
  "qt  ",
]);

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return new TextDecoder().decode(bytes.subarray(offset, offset + length));
}

/** Detect MP4/MOV container via ISO BMFF `ftyp` box at offset 4. */
export function detectMp4OrMovMimeType(bytes: Uint8Array): string | null {
  if (bytes.byteLength < 12) return null;
  if (readAscii(bytes, 4, 4) !== "ftyp") return null;

  const majorBrand = readAscii(bytes, 8, 4);
  if (MP4_FTYP_BRANDS.has(majorBrand)) {
    return majorBrand.trim() === "qt" ? "video/quicktime" : "video/mp4";
  }

  // Some CapCut exports use other compatible brands — still accept any ftyp box.
  return "video/mp4";
}

export function validateDownloadedVideoBytes(bytes: Uint8Array): { mimeType: string } {
  if (bytes.byteLength < MIN_VIDEO_BYTES) {
    throw new Error(
      `invalid_video_file: file too small (${bytes.byteLength} bytes). Ensure Google Drive link points to a valid video.`,
    );
  }

  const detected = detectMp4OrMovMimeType(bytes);
  if (!detected) {
    throw new Error(
      "invalid_video_file: not a valid mp4/mov container. Re-export the video as MP4 and upload again.",
    );
  }

  return { mimeType: detected };
}

export function resolveValidatedVideoMimeType(
  bytes: Uint8Array,
  headerContentType: string | null,
): string {
  const validated = validateDownloadedVideoBytes(bytes);
  const header = String(headerContentType ?? "").split(";")[0].trim().toLowerCase();
  if (header.startsWith("video/")) return header;
  return validated.mimeType;
}
