export function getEmbedUrl(url: string): string {
  if (!url) return '';
  const fileId = extractGoogleDriveFileId(url);
  if (fileId && url.toLowerCase().includes('drive.google.com')) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) return '';
  return url;
}

/** Direct stream URL for HTML5 video (one-click play). Uses usercontent endpoint to avoid virus-scan redirect; fallback to iframe on error. */
export function getDirectVideoUrl(url: string): string {
  if (!url) return '';
  const fileId = extractGoogleDriveFileId(url);
  if (fileId) {
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  }
  return '';
}

/** Google Drive folder grid embed (works for guests when folder is shared with link). */
export function getFolderEmbedUrl(url: string): string {
  const folderId = extractGoogleDriveFolderId(url);
  if (!folderId) return '';
  return `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#grid`;
}

/** YouTube embed URL for in-page preview. */
export function getYouTubeEmbedUrl(url: string): string {
  if (!url?.trim()) return '';
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`;
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
  return '';
}

export function isFolderLink(url: string): boolean {
  return url.includes('drive.google.com/drive/folders/');
}

export function isFileLink(url: string): boolean {
  if (!url?.trim()) return false;
  if (isFolderLink(url)) return false;
  return extractGoogleDriveFileId(url) !== null;
}

export function isYouTubeLink(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

/** Google Drive file id from /file/d/{id}/ or open?id= (and similar). */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url?.trim()) return null;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/i);
  if (fileMatch) return fileMatch[1];
  if (url.includes('drive.google.com') && /[?&]id=([a-zA-Z0-9-_]+)/i.test(url)) {
    const openMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/i);
    if (openMatch) return openMatch[1];
  }
  return null;
}

/** Google Drive folder id from /drive/folders/{id}. */
export function extractGoogleDriveFolderId(url: string): string | null {
  if (!url?.trim()) return null;
  const m = url.match(/\/folders\/([a-zA-Z0-9-_]+)/i);
  return m ? m[1] : null;
}

/** Request a larger bitmap from Google thumbnail URLs when the pattern is known (best-effort). */
export function upscaleGoogleDriveThumbnailUrl(url: string): string {
  if (!url?.trim()) return url;
  if (url.includes("googleusercontent.com") && /=s\d+/.test(url)) {
    return url.replace(/=s\d+/, "=s2000");
  }
  if (url.includes("drive.google.com/thumbnail")) {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      u.searchParams.set("sz", "w2000");
      return u.toString();
    } catch {
      return url;
    }
  }
  if (url.includes("googleusercontent.com") && /=w\d+-h\d+/.test(url)) {
    return url.replace(/=w\d+-h\d+(-[a-z]*)?/i, "=w2000-h2000");
  }
  return url;
}

/**
 * Canonical form for comparing whether two Drive URLs refer to the same file or folder.
 * File: `file:{id}`; folder: `folder:{id}`; otherwise trimmed lowercase origin+path without query.
 */
export function normalizeGoogleDriveUrl(url: string): string {
  const raw = url?.trim() ?? '';
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (isFolderLink(lower)) {
    const id = extractGoogleDriveFolderId(raw);
    return id ? `folder:${id}` : lower.split('?')[0].split('#')[0];
  }
  const fileId = extractGoogleDriveFileId(raw);
  if (fileId && lower.includes('drive.google.com')) {
    return `file:${fileId}`;
  }
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return lower.split('?')[0].split('#')[0];
  }
}

export function linksSemanticallyEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return normalizeGoogleDriveUrl(a ?? '') === normalizeGoogleDriveUrl(b ?? '');
}
