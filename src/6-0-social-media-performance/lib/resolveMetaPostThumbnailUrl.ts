function looksLikeVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) || /\/video\//i.test(url);
}

export function resolveMetaPostThumbnailUrl(row: {
  media_url?: string | null;
  thumbnail_url?: string | null;
}): string | null {
  const thumb = row.thumbnail_url?.trim() || null;
  const media = row.media_url?.trim() || null;

  if (thumb) return thumb;
  if (media && !looksLikeVideoUrl(media)) return media;
  return null;
}
