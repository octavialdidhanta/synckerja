import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ThreadsCommentItem } from '@/6-0-social-media-manage-comments/components/threads/ThreadsCommentItem';
import type { ManageCommentsReplyControls } from '@/6-0-social-media-manage-comments/types/manageCommentsReplyControls';
import { MANAGE_COMMENTS_THREAD_POLL_MS } from '@/6-0-social-media-manage-comments/lib/manageCommentsPolling';
import {
  useThreadsContentCommentRepliesQuery,
  type ThreadsContentCommentRow,
} from '@/threads-content/hooks/useThreadsContentComments';

type ThreadsCommentReplyThreadProps = {
  organizationId: string;
  accountId: string;
  mediaId: string;
  commentId: string;
  replyControls: ManageCommentsReplyControls;
  isMutating?: boolean;
  forceOpen?: boolean;
  hiddenTexts?: Set<string>;
  replyDisabled?: boolean;
  highlightedIds?: Set<string>;
  onHide?: (commentId: string) => void;
  onDelete?: (commentId: string, parentCommentId?: string | null) => void;
  onEdit?: (commentId: string, parentCommentId: string, text: string) => Promise<void>;
  isSubmittingEdit?: boolean;
  onServerRepliesLoaded?: (parentCommentId: string, serverComments: ThreadsContentCommentRow[]) => void;
};

export function ThreadsCommentReplyThread({
  organizationId,
  accountId,
  mediaId,
  commentId,
  replyControls,
  isMutating,
  forceOpen,
  hiddenTexts,
  replyDisabled = false,
  highlightedIds,
  onHide,
  onDelete,
  onEdit,
  isSubmittingEdit,
  onServerRepliesLoaded,
}: ThreadsCommentReplyThreadProps) {
  const { t } = useTranslation();
  const shouldFetch =
    forceOpen ||
    replyControls.replyToCommentId === commentId ||
    replyControls.getOptimisticForParent(commentId).length > 0;

  const repliesQuery = useThreadsContentCommentRepliesQuery({
    organizationId,
    accountId,
    mediaId,
    commentId,
    enabled: Boolean(organizationId && accountId && mediaId && commentId && shouldFetch),
    refetchIntervalMs: shouldFetch ? MANAGE_COMMENTS_THREAD_POLL_MS : undefined,
  });

  const serverReplies = useMemo(() => {
    const rows = repliesQuery.data?.comments ?? [];
    const hidden = hiddenTexts ?? new Set<string>();
    return [...rows]
      .filter((row) => !hidden.has(row.text.trim()))
      .sort((a, b) => {
        const ta = a.published_at ? Date.parse(a.published_at) : 0;
        const tb = b.published_at ? Date.parse(b.published_at) : 0;
        return tb - ta;
      });
  }, [repliesQuery.data?.comments, hiddenTexts]);

  const pruneOptimistic = replyControls.pruneOptimisticForParent;
  useEffect(() => {
    const serverComments = repliesQuery.data?.comments ?? [];
    if (!serverComments.length) return;
    pruneOptimistic(
      commentId,
      serverComments.map((c) => c.text),
    );
  }, [repliesQuery.data?.comments, commentId, pruneOptimistic]);

  useEffect(() => {
    if (serverReplies.length === 0) return;
    onServerRepliesLoaded?.(commentId, serverReplies);
  }, [serverReplies, commentId, onServerRepliesLoaded]);

  if (!shouldFetch) return null;

  const showLoading = repliesQuery.isLoading && serverReplies.length === 0;

  if (showLoading) {
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
          replyDisabled={replyDisabled}
          isNew={highlightedIds?.has(reply.id)}
          highlightedIds={highlightedIds}
          onHide={onHide}
          onDelete={onDelete}
          onEdit={onEdit}
          isSubmittingEdit={isSubmittingEdit}
          onServerRepliesLoaded={onServerRepliesLoaded}
        />
      ))}
    </div>
  );
}
