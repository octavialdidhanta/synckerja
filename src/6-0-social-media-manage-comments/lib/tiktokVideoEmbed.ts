/** Resolve TikTok post id for embed player. */
export function resolveTikTokVideoId(videoId: string, shareUrl: string | null): string | null {
  const id = videoId.trim();
  if (/^\d+$/.test(id)) return id;
  const fromVideoUrl = shareUrl?.match(/\/video\/(\d+)/)?.[1];
  if (fromVideoUrl) return fromVideoUrl;
  const fromPhotoUrl = shareUrl?.match(/\/photo\/(\d+)/)?.[1];
  return fromPhotoUrl ?? (id || null);
}

export function tiktokEmbedCiteUrl(shareUrl: string | null, videoId: string): string | null {
  const trimmedShare = shareUrl?.trim();
  if (trimmedShare) return trimmedShare;
  const resolvedId = resolveTikTokVideoId(videoId, shareUrl);
  if (!resolvedId) return null;
  return `https://www.tiktok.com/t/${resolvedId}`;
}

/** Photo / image carousel posts (no misleading video play chrome). */
export function isTikTokPhotoPost(
  shareUrl: string | null,
  duration: number | null | undefined,
): boolean {
  if (shareUrl && /\/photo\//i.test(shareUrl)) return true;
  if (duration != null && duration <= 0) return true;
  return false;
}

export type TikTokPlayerEmbedOptions = {
  isPhotoPost?: boolean;
};

/** Official TikTok player iframe — video-only, no promotional footer scroll. */
export function tiktokVideoPlayerSrc(
  videoId: string,
  options?: TikTokPlayerEmbedOptions,
): string {
  const isPhoto = options?.isPhotoPost ?? false;
  const params = new URLSearchParams({
    music_info: "0",
    description: "0",
    rel: "0",
    controls: isPhoto ? "0" : "1",
    progress_bar: isPhoto ? "0" : "1",
    play_button: isPhoto ? "0" : "1",
    volume_control: isPhoto ? "0" : "1",
    timestamp: isPhoto ? "0" : "1",
  });
  return `https://www.tiktok.com/player/v1/${encodeURIComponent(videoId)}?${params}`;
}

/** Full-page TikTok embed (includes CTA footer — prefer player/v1 in manage-comments UI). */
export function tiktokEmbedV2Src(videoId: string): string {
  return `https://www.tiktok.com/embed/v2/${encodeURIComponent(videoId)}`;
}
