import { memo } from "react";
import { useTranslation } from "react-i18next";
import { TikTokPostCaption } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokPostCaption";
import { TikTokPostVideoPlayer } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokPostVideoPlayer";
import { formatPostEngagementStats } from "@/6-0-social-media-manage-comments/lib/formatPostEngagementStats";
import { useManageCommentsMobileLayout } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsMobileLayoutContext";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

type TikTokCommentPostPreviewProps = {
  post: ManageCommentsPostListItem;
  compact?: boolean;
};

export const TikTokCommentPostPreview = memo(function TikTokCommentPostPreview({
  post,
  compact,
}: TikTokCommentPostPreviewProps) {
  const { t, i18n } = useTranslation();
  const isMobileLayout = useManageCommentsMobileLayout();
  if (isMobileLayout) return null;
  const statsLabel = formatPostEngagementStats(post, t, i18n.language);
  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <TikTokPostVideoPlayer
        videoId={post.id}
        shareUrl={post.shareUrl}
        coverImageUrl={post.coverImageUrl}
        title={post.title}
        duration={post.duration}
        className={compact ? "max-w-none" : undefined}
      />
      <div className={compact ? "border-t border-gray-100 px-3 py-2" : "border-t border-gray-100 px-4 py-3"}>
        <TikTokPostCaption text={post.title} className={compact ? "space-y-1" : undefined} />
        {compact ? null : <p className="mt-3 text-xs text-muted-foreground">{statsLabel}</p>}
      </div>
    </div>
  );
}, arePreviewPropsEqual);

function arePreviewPropsEqual(
  prev: TikTokCommentPostPreviewProps,
  next: TikTokCommentPostPreviewProps,
): boolean {
  return (
    prev.compact === next.compact &&
    prev.post.id === next.post.id &&
    prev.post.shareUrl === next.post.shareUrl &&
    prev.post.coverImageUrl === next.post.coverImageUrl &&
    prev.post.title === next.post.title &&
    prev.post.duration === next.post.duration
  );
}
