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
  _duration?: number | null,
): boolean {
  return Boolean(shareUrl && /\/photo\//i.test(shareUrl));
}

export type TikTokPlayerEmbedOptions = {
  isPhotoPost?: boolean;
  autoplay?: boolean;
};

/** Official TikTok player iframe — video-only, no promotional footer scroll. */
export function tiktokVideoPlayerSrc(
  videoId: string,
  options?: TikTokPlayerEmbedOptions,
): string {
  const isPhoto = options?.isPhotoPost ?? false;
  const autoplay = options?.autoplay === true && !isPhoto;
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    muted: "0",
    music_info: "0",
    description: "0",
    rel: "0",
    native_context_menu: "0",
    closed_caption: "0",
    controls: isPhoto ? "0" : "1",
    progress_bar: isPhoto ? "0" : "1",
    play_button: isPhoto ? "0" : "1",
    volume_control: isPhoto ? "0" : "1",
    fullscreen_button: isPhoto ? "0" : "1",
    timestamp: isPhoto ? "0" : "1",
  });
  return `https://www.tiktok.com/player/v1/${encodeURIComponent(videoId)}?${params}`;
}

export function postTikTokPlayerMessage(
  iframe: HTMLIFrameElement | null,
  type: "play" | "pause" | "mute" | "unMute",
  value?: unknown,
) {
  iframe?.contentWindow?.postMessage(
    { type, value, "x-tiktok-player": true },
    "*",
  );
}

export function isTikTokPlayerMessage(
  event: MessageEvent,
  iframe: HTMLIFrameElement | null,
): event is MessageEvent<{ type?: string; value?: unknown }> {
  if (!iframe || event.source !== iframe.contentWindow) return false;
  const data = event.data as { "x-tiktok-player"?: boolean; type?: string } | null;
  return Boolean(data && data["x-tiktok-player"] === true && data.type);
}

/** Full-page TikTok embed (includes CTA footer — prefer player/v1 in manage-comments UI). */
export function tiktokEmbedV2Src(videoId: string): string {
  return `https://www.tiktok.com/embed/v2/${encodeURIComponent(videoId)}`;
}
