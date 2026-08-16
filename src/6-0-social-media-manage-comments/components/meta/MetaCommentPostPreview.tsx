import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { TikTokPostCaption } from '@/6-0-social-media-manage-comments/components/tiktok/TikTokPostCaption';
import { MetaPostMediaPlayer } from '@/6-0-social-media-manage-comments/components/meta/MetaPostMediaPlayer';
import { formatPostEngagementStats } from '@/6-0-social-media-manage-comments/lib/formatPostEngagementStats';
import { useManageCommentsMobileLayout } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsMobileLayoutContext';
import type { ManageCommentsPostListItem } from '@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes';

type MetaCommentPostPreviewProps = {
  post: ManageCommentsPostListItem;
  compact?: boolean;
};

export const MetaCommentPostPreview = memo(function MetaCommentPostPreview({
  post,
  compact,
}: MetaCommentPostPreviewProps) {
  const { t, i18n } = useTranslation();
  const isMobileLayout = useManageCommentsMobileLayout();
  if (isMobileLayout) return null;
  const statsLabel = formatPostEngagementStats(post, t, i18n.language);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <MetaPostMediaPlayer
        postId={post.id}
        coverImageUrl={post.coverImageUrl}
        title={post.title}
        videoUrl={post.videoUrl}
        mediaType={post.mediaType}
        shareUrl={
          post.shareUrl ??
          (post.id.includes('_') ? `https://www.facebook.com/${post.id}` : null)
        }
        className={compact ? 'max-w-none' : undefined}
      />
      <div className={compact ? 'border-t border-gray-100 px-3 py-2' : 'border-t border-gray-100 px-4 py-3'}>
        <TikTokPostCaption text={post.title} className={compact ? 'space-y-1' : undefined} />
        {compact ? null : <p className="mt-3 text-xs text-muted-foreground">{statsLabel}</p>}
      </div>
    </div>
  );
}, arePreviewPropsEqual);

function arePreviewPropsEqual(
  prev: MetaCommentPostPreviewProps,
  next: MetaCommentPostPreviewProps,
): boolean {
  return (
    prev.compact === next.compact &&
    prev.post.id === next.post.id &&
    prev.post.videoUrl === next.post.videoUrl &&
    prev.post.coverImageUrl === next.post.coverImageUrl &&
    prev.post.shareUrl === next.post.shareUrl &&
    prev.post.title === next.post.title &&
    prev.post.mediaType === next.post.mediaType
  );
}
