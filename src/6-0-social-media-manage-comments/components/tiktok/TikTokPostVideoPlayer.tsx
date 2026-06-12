import {
  isTikTokPhotoPost,
  resolveTikTokVideoId,
  tiktokVideoPlayerSrc,
} from "@/6-0-social-media-manage-comments/lib/tiktokVideoEmbed";

type TikTokPostVideoPlayerProps = {
  videoId: string;
  shareUrl: string | null;
  coverImageUrl: string | null;
  title: string;
  duration?: number | null;
};

/**
 * Native TikTok player iframe (v1). Fits the white preview card via 9:16 aspect
 * ratio — avoids embed/v2 footer ("Watch now") that forces an inner scrollbar.
 */
export function TikTokPostVideoPlayer({
  videoId,
  shareUrl,
  coverImageUrl,
  title,
  duration = null,
}: TikTokPostVideoPlayerProps) {
  const resolvedId = resolveTikTokVideoId(videoId, shareUrl);
  const isPhotoPost = isTikTokPhotoPost(shareUrl, duration);

  if (!resolvedId) {
    return coverImageUrl ? (
      <div className="mx-auto w-full max-w-[325px]">
        <img
          src={coverImageUrl}
          alt=""
          className="aspect-[9/16] w-full object-cover"
        />
      </div>
    ) : null;
  }

  const embedSrc = tiktokVideoPlayerSrc(resolvedId, { isPhotoPost });

  return (
    <div className="mx-auto w-full max-w-[325px] overflow-hidden bg-black">
      <div className="relative aspect-[9/16] w-full">
        <iframe
          key={resolvedId}
          title={title}
          src={embedSrc}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}

TikTokPostVideoPlayer.displayName = "TikTokPostVideoPlayer";
