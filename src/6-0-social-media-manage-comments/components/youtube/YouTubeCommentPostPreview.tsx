import { useTranslation } from "react-i18next";
import { getYouTubeEmbedUrl } from "@/6-1-dashboard/utils/previewUtils";
import { formatPostEngagementStats } from "@/6-0-social-media-manage-comments/lib/formatPostEngagementStats";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

type YouTubeCommentPostPreviewProps = {
  post: ManageCommentsPostListItem;
};

export function YouTubeCommentPostPreview({ post }: YouTubeCommentPostPreviewProps) {
  const { t, i18n } = useTranslation();
  const statsLabel = formatPostEngagementStats(post, t, i18n.language);
  const embedUrl =
    getYouTubeEmbedUrl(post.shareUrl ?? "") ||
    getYouTubeEmbedUrl(`https://www.youtube.com/watch?v=${post.id}`);

  return (
    <div className="mt-3 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="relative aspect-video w-full bg-black">
        {embedUrl ? (
          <iframe
            key={post.id}
            src={embedUrl}
            title={post.title}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : post.coverImageUrl ? (
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("digitalMarketing.manageComments.youtubePreviewUnavailable", "Preview unavailable")}
          </div>
        )}
      </div>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="line-clamp-3 text-sm font-medium text-gray-900">{post.title}</p>
        <p className="mt-3 text-xs text-muted-foreground">{statsLabel}</p>
      </div>
    </div>
  );
}

YouTubeCommentPostPreview.displayName = "YouTubeCommentPostPreview";
