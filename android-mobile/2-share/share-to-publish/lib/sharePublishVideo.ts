import type { ShareIntentFileItem } from "@/plugins/share-intent";

/** Native cache file reference — avoids loading large videos into JS memory. */
export type SharePublishVideo = {
  path: string;
  name: string;
  mimeType: string;
  size: number;
};

function isVideoName(name: string): boolean {
  return /\.(mp4|mov|webm|m4v|mkv|3gp)$/i.test(name);
}

export function isSharePublishVideoMime(mime: string): boolean {
  return mime.toLowerCase().startsWith("video/");
}

export function shareIntentItemToVideo(item: ShareIntentFileItem): SharePublishVideo | null {
  const mime = (item.mimeType || "").trim();
  const name = item.name || "shared-video.mp4";
  if (!isSharePublishVideoMime(mime) && !isVideoName(name)) return null;
  const size = typeof item.size === "number" && item.size > 0 ? item.size : 0;
  return {
    path: item.path,
    name,
    mimeType: mime || "video/mp4",
    size,
  };
}
