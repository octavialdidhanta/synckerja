import { useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { TikTokPostCaption } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokPostCaption";
import { TikTokPostVideoPlayer } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokPostVideoPlayer";
import { MetaPostMediaPlayer } from "@/6-0-social-media-manage-comments/components/meta/MetaPostMediaPlayer";
import { formatPostEngagementStats } from "@/6-0-social-media-manage-comments/lib/formatPostEngagementStats";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";
import { getYouTubePlayableEmbedUrl } from "@/6-1-dashboard/utils/previewUtils";
import { MobileManageCommentsLikesDrawer } from "@/mobile/6-0-social-media-performance/components/MobileManageCommentsLikesDrawer";
import type { MetaContentPlatform } from "@/meta-platform/types/metaContentTypes";

type MobileManageCommentsPostPreviewProps = {
  post: ManageCommentsPostListItem;
  platform: "tiktok" | "youtube" | "instagram" | "facebook" | "linkedin" | "threads";
  likesContext?: {
    organizationId: string;
    accountId: string;
  };
};

export function MobileManageCommentsPostPreview({
  post,
  platform,
  likesContext,
}: MobileManageCommentsPostPreviewProps) {
  const { t, i18n } = useTranslation();
  const [likesOpen, setLikesOpen] = useState(false);
  const nf = new Intl.NumberFormat(i18n.language);
  const canOpenLikes = Boolean(likesContext) && platform === "facebook";
  const statsLabel = formatPostEngagementStats(post, t, i18n.language);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="rounded-t-xl bg-black">
        <PublishedMedia post={post} platform={platform} />
      </div>
      <div className="px-3 py-3">
        <TikTokPostCaption
          text={post.title}
          className="space-y-2 [&>p]:line-clamp-4 [&>p]:whitespace-pre-wrap"
        />
        {canOpenLikes ? (
          <p className="mt-2 text-xs text-muted-foreground">
            <button
              type="button"
              className="font-medium text-foreground underline-offset-2 hover:underline"
              onClick={() => setLikesOpen(true)}
            >
              {nf.format(post.likeCount)} {t("digitalMarketing.manageComments.likes", "likes")}
            </button>
            {` · ${nf.format(post.commentCount)} ${t("digitalMarketing.manageComments.comments", "comments")}`}
            {` · ${nf.format(post.viewCount ?? 0)} ${t("digitalMarketing.manageComments.views", "views")}`}
          </p>
        ) : statsLabel ? (
          <p className="mt-2 text-xs text-muted-foreground">{statsLabel}</p>
        ) : null}
      </div>
      {canOpenLikes && likesContext ? (
        <MobileManageCommentsLikesDrawer
          open={likesOpen}
          onOpenChange={setLikesOpen}
          organizationId={likesContext.organizationId}
          platform={platform}
          accountId={likesContext.accountId}
          mediaId={post.id}
        />
      ) : null}
    </div>
  );
}

function youtubeEmbedSrc(post: ManageCommentsPostListItem, autoplay = false): string {
  const base =
    getYouTubePlayableEmbedUrl(post.shareUrl ?? "") ||
    getYouTubePlayableEmbedUrl(post.id) ||
    getYouTubePlayableEmbedUrl(`https://www.youtube.com/watch?v=${post.id}`);
  if (!base || !autoplay) return base;
  const parsed = new URL(base);
  parsed.searchParams.set("autoplay", "1");
  parsed.searchParams.set("mute", "0");
  return parsed.toString();
}

function youtubePosterUrl(post: ManageCommentsPostListItem): string | null {
  if (post.coverImageUrl) return post.coverImageUrl;
  const id = post.id.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

function MobileYouTubePostPlayer({ post }: { post: ManageCommentsPostListItem }) {
  const [playing, setPlaying] = useState(false);
  const isShort = /\/shorts\//i.test(post.shareUrl ?? "");
  const embedUrl = youtubeEmbedSrc(post, playing);
  const poster = youtubePosterUrl(post);
  if (!embedUrl) return null;

  return (
    <div
      className={
        isShort
          ? "relative mx-auto aspect-[9/16] h-[min(38vh,100%)] w-auto max-w-full bg-black [touch-action:manipulation]"
          : "relative aspect-video w-full bg-black [touch-action:manipulation]"
      }
    >
      {playing ? (
        <iframe
          key={`${post.id}-play`}
          src={embedUrl}
          title={post.title}
          className="absolute inset-0 z-10 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <>
          {poster ? (
            <img
              src={poster}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 bg-black" />
          )}
          <button
            type="button"
            className="absolute inset-0 z-20 flex items-center justify-center"
            aria-label="Play"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              flushSync(() => setPlaying(true));
            }}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-md">
              <span className="ml-1 h-0 w-0 border-y-[10px] border-y-transparent border-l-[18px] border-l-white" />
            </span>
          </button>
        </>
      )}
    </div>
  );
}

function PublishedMedia({
  post,
  platform,
}: MobileManageCommentsPostPreviewProps) {
  if (platform === "youtube") {
    return <MobileYouTubePostPlayer post={post} />;
  }

  if (platform === "tiktok") {
    return (
      <TikTokPostVideoPlayer
        videoId={post.id}
        shareUrl={post.shareUrl}
        coverImageUrl={post.coverImageUrl}
        title={post.title}
        duration={post.duration}
        className="mx-auto max-h-[28vh] w-auto max-w-full aspect-[9/16]"
      />
    );
  }

  const looksLikeVideo = /video|reel|shorts/i.test(post.mediaType ?? "");
  const looksLikeImage = /image|carousel|photo|album/i.test(post.mediaType ?? "");

  if (looksLikeImage && !looksLikeVideo && post.coverImageUrl && !post.videoUrl) {
    return (
      <img
        src={post.coverImageUrl}
        alt={post.title}
        className="mx-auto max-h-[38vh] w-full object-contain"
      />
    );
  }

  if (post.videoUrl) {
    return (
      <video
        className="mx-auto max-h-[38vh] w-full object-contain"
        src={post.videoUrl}
        poster={post.coverImageUrl ?? undefined}
        controls
        playsInline
        preload="metadata"
      />
    );
  }

  if (looksLikeVideo || post.shareUrl) {
    return (
      <MetaPostMediaPlayer
        postId={post.id}
        coverImageUrl={post.coverImageUrl}
        title={post.title}
        videoUrl={post.videoUrl}
        mediaType={post.mediaType}
        shareUrl={post.shareUrl}
        className="max-w-none"
      />
    );
  }

  if (post.coverImageUrl) {
    return (
      <img
        src={post.coverImageUrl}
        alt={post.title}
        className="mx-auto max-h-[38vh] w-full object-contain"
      />
    );
  }

  return (
    <MetaPostMediaPlayer
      postId={post.id}
      coverImageUrl={post.coverImageUrl}
      title={post.title}
      videoUrl={post.videoUrl}
      mediaType={post.mediaType}
      shareUrl={post.shareUrl}
      className="max-w-none"
    />
  );
}

MobileManageCommentsPostPreview.displayName = "MobileManageCommentsPostPreview";
