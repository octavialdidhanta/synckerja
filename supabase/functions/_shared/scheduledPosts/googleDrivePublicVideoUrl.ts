/** Extract Google Drive file id from share URL. */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url?.trim()) return null;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/i);
  if (fileMatch) return fileMatch[1];
  if (url.includes("drive.google.com") && /[?&]id=([a-zA-Z0-9-_]+)/i.test(url)) {
    const openMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/i);
    if (openMatch) return openMatch[1];
  }
  return null;
}

export function isGoogleDriveFolderLink(url: string): boolean {
  return url.includes("drive.google.com/drive/folders/");
}

export function isGoogleDriveFileLink(url: string): boolean {
  if (!url?.trim()) return false;
  if (isGoogleDriveFolderLink(url)) return false;
  return extractGoogleDriveFileId(url) !== null;
}

/** Direct download URL for public Google Drive video (server-side fetch for TikTok FILE_UPLOAD). */
export function resolveGoogleDrivePublicVideoUrl(url: string): string | null {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return null;
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
}

export function normalizeGoogleDriveUrl(url: string): string {
  const raw = url?.trim() ?? "";
  if (!raw) return "";
  const fileId = extractGoogleDriveFileId(raw);
  if (fileId && raw.toLowerCase().includes("drive.google.com")) {
    return `file:${fileId}`;
  }
  return raw.toLowerCase().split("?")[0].split("#")[0];
}

export function googleDriveLinksSemanticallyEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeGoogleDriveUrl(a ?? "") === normalizeGoogleDriveUrl(b ?? "");
}
