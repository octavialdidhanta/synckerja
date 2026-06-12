import { useTranslation } from "react-i18next";
import { TikTokPostCaption } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokPostCaption";
import { TikTokPostVideoPlayer } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokPostVideoPlayer";
import { formatPostEngagementStats } from "@/6-0-social-media-manage-comments/lib/formatPostEngagementStats";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

type TikTokCommentPostPreviewProps = {
  post: ManageCommentsPostListItem;
};

export function TikTokCommentPostPreview({ post }: TikTokCommentPostPreviewProps) {
  const { t, i18n } = useTranslation();
  const statsLabel = formatPostEngagementStats(post, t, i18n.language);
  return (
    <div className="mt-3 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <TikTokPostVideoPlayer
        key={post.id}
        videoId={post.id}
        shareUrl={post.shareUrl}
        coverImageUrl={post.coverImageUrl}
        title={post.title}
        duration={post.duration}
      />
      <div className="border-t border-gray-100 px-4 py-3">
        <TikTokPostCaption text={post.title} />
        <p className="mt-3 text-xs text-muted-foreground">{statsLabel}</p>
      </div>
    </div>
  );
}

TikTokCommentPostPreview.displayName = "TikTokCommentPostPreview";
