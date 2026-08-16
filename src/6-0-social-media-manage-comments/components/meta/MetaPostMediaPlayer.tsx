import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';

type MetaPostMediaPlayerProps = {
  postId?: string;
  coverImageUrl: string | null;
  title: string;
  className?: string;
  videoUrl?: string | null;
  mediaType?: string | null;
  shareUrl?: string | null;
};

function facebookPermalinkLooksLikeVideo(shareUrl: string): boolean {
  return /facebook\.com\/(?:.*\/)?(?:videos|reel|reels|watch)\b/i.test(shareUrl);
}

function facebookEmbedSrc(shareUrl: string): string {
  const params = new URLSearchParams({
    href: shareUrl,
    show_text: 'false',
  });
  const plugin = facebookPermalinkLooksLikeVideo(shareUrl) ? 'video.php' : 'post.php';
  return `https://www.facebook.com/plugins/${plugin}?${params}`;
}

/** Compact Instagram embed (not /embed/captioned). */
function instagramEmbedSrc(shareUrl: string): string | null {
  const shortcode = shareUrl.match(/\/(?:reel|reels|p|tv)\/([^/?#]+)/i)?.[1];
  if (!shortcode) return null;
  const kind = /\/(?:reel|reels)\//i.test(shareUrl) ? 'reel' : 'p';
  return `https://www.instagram.com/${kind}/${encodeURIComponent(shortcode)}/embed/?hidecaption=1`;
}

/** Native MP4, Facebook plugin (permalink), or static image. */
export const MetaPostMediaPlayer = memo(function MetaPostMediaPlayer({
  postId,
  coverImageUrl,
  title,
  className,
  videoUrl,
  shareUrl,
}: MetaPostMediaPlayerProps) {
  const { t } = useTranslation();
  const lockedVideoUrlRef = useRef<{ postId: string; url: string } | null>(null);
  const incomingVideoUrl = videoUrl?.trim() || null;
  const lockKey = postId || incomingVideoUrl || '';
  if (incomingVideoUrl && lockKey) {
    if (lockedVideoUrlRef.current?.postId !== lockKey) {
      lockedVideoUrlRef.current = { postId: lockKey, url: incomingVideoUrl };
    }
  }
  const playableVideoUrl =
    lockedVideoUrlRef.current?.postId === lockKey
      ? lockedVideoUrlRef.current.url
      : incomingVideoUrl;
  const permalink = shareUrl?.trim() || null;
  const instagramEmbed = !playableVideoUrl && permalink ? instagramEmbedSrc(permalink) : null;
  const useFacebookEmbed = !playableVideoUrl && Boolean(permalink && /facebook\.com/i.test(permalink));

  if (playableVideoUrl) {
    return (
      <div className={cn('mx-auto w-full max-w-[325px] overflow-hidden bg-black', className)}>
        <div className="relative aspect-[9/16] w-full">
          <video
            className="absolute inset-0 h-full w-full object-contain"
            src={playableVideoUrl}
            poster={coverImageUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
          />
        </div>
      </div>
    );
  }

  if (instagramEmbed) {
    return (
      <div className={cn('mx-auto w-full max-w-[325px] overflow-hidden bg-black', className)}>
        <div className="relative aspect-[9/16] w-full">
          <iframe
            title={title}
            src={instagramEmbed}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    );
  }

  if (useFacebookEmbed && permalink) {
    return (
      <div className={cn('mx-auto w-full max-w-[325px] overflow-hidden bg-black', className)}>
        <div className="relative aspect-[9/16] w-full">
          <iframe
            title={title}
            src={facebookEmbedSrc(permalink)}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    );
  }

  if (!coverImageUrl) {
    return (
      <div
        className={cn(
          'mx-auto flex w-full max-w-[325px] aspect-[9/16] items-center justify-center bg-gray-100 px-4 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        {t('digitalMarketing.manageComments.metaPreviewNoMedia', 'No preview image for this post.')}
      </div>
    );
  }

  return (
    <div className={cn('mx-auto w-full max-w-[325px] overflow-hidden bg-black', className)}>
      <div className="relative aspect-[9/16] w-full">
        <img
          src={coverImageUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );
});
