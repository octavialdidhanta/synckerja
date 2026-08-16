export function getEmbedUrl(url: string): string {
  if (!url) return '';
  const fileId = extractGoogleDriveFileId(url);
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) return '';
  return url;
}

/** Direct stream URL for HTML5 video (public Drive files). */
export function getDirectVideoUrl(url: string): string {
  if (!url) return '';
  const fileId = extractGoogleDriveFileId(url);
  if (fileId) {
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  }
  return '';
}

/** Alternate public download URL when usercontent endpoint fails in-browser. */
export function getGoogleDriveUcDownloadUrl(url: string): string {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return '';
  return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
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
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/embed/${trimmed}`;
  }
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`;
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
  const liveMatch = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  if (liveMatch) return `https://www.youtube.com/embed/${liveMatch[1]}`;
  return '';
}

/** Same youtube.com/embed player, with mobile playback params (not a different embed). */
export function getYouTubePlayableEmbedUrl(url: string): string {
  const embed = getYouTubeEmbedUrl(url);
  if (!embed) return '';
  const parsed = new URL(embed);
  parsed.searchParams.set('playsinline', '1');
  parsed.searchParams.set('rel', '0');
  parsed.searchParams.set('modestbranding', '1');
  parsed.searchParams.set('enablejsapi', '1');
  if (typeof window !== 'undefined' && window.location?.origin) {
    parsed.searchParams.set('origin', window.location.origin);
  }
  return parsed.toString();
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

/** Google Drive file id from /file/d/{id}/, /d/{id}/, or open?id= (and similar). */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url?.trim()) return null;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/i);
  if (fileMatch) return fileMatch[1];
  const shortMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/i);
  if (shortMatch) return shortMatch[1];
  if (/[?&]id=([a-zA-Z0-9-_]+)/i.test(url)) {
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
