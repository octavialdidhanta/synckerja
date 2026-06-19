import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ThreadsCommentItem } from '@/6-0-social-media-manage-comments/components/threads/ThreadsCommentItem';
import type { ManageCommentsReplyControls } from '@/6-0-social-media-manage-comments/types/manageCommentsReplyControls';
import { useThreadsContentCommentRepliesQuery } from '@/threads-content/hooks/useThreadsContentComments';

type ThreadsCommentReplyThreadProps = {
  organizationId: string;
  accountId: string;
  mediaId: string;
  commentId: string;
  replyControls: ManageCommentsReplyControls;
  isMutating?: boolean;
  forceOpen?: boolean;
};

export function ThreadsCommentReplyThread({
  organizationId,
  accountId,
  mediaId,
  commentId,
  replyControls,
  isMutating,
  forceOpen,
}: ThreadsCommentReplyThreadProps) {
  const { t } = useTranslation();
  const shouldFetch = forceOpen || replyControls.replyToCommentId === commentId;

  const repliesQuery = useThreadsContentCommentRepliesQuery({
    organizationId,
    accountId,
    mediaId,
    commentId,
    enabled: Boolean(organizationId && accountId && mediaId && commentId && shouldFetch),
  });

  const serverReplies = useMemo(() => {
    const rows = repliesQuery.data?.comments ?? [];
    return [...rows].sort((a, b) => {
      const ta = a.published_at ? Date.parse(a.published_at) : 0;
      const tb = b.published_at ? Date.parse(b.published_at) : 0;
      return tb - ta;
    });
  }, [repliesQuery.data?.comments]);

  if (!shouldFetch) return null;

  if (repliesQuery.isLoading && serverReplies.length === 0) {
    return (
      <div className="mt-2 flex items-center gap-2 border-l-2 border-sky-200 pl-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('digitalMarketing.manageComments.loadingReplies', 'Loading replies…')}
      </div>
    );
  }

  if (serverReplies.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 border-l-2 border-sky-300 pl-3">
      {serverReplies.map((reply) => (
        <ThreadsCommentItem
          key={reply.id}
          comment={reply}
          organizationId={organizationId}
          accountId={accountId}
          mediaId={mediaId}
          nested
          replyControls={replyControls}
          isMutating={isMutating}
        />
      ))}
    </div>
  );
}
