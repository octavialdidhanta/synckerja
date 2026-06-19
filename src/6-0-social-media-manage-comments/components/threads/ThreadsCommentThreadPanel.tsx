import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { ManageCommentsEmptyState } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsEmptyState';
import { ManageCommentsThreadHeader } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsThreadHeader';
import { MetaCommentPostPreview } from '@/6-0-social-media-manage-comments/components/meta/MetaCommentPostPreview';
import { ThreadsCommentItem } from '@/6-0-social-media-manage-comments/components/threads/ThreadsCommentItem';
import type { ManageCommentsReplyControls } from '@/6-0-social-media-manage-comments/types/manageCommentsReplyControls';
import type { ManageCommentsPostListItem } from '@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes';
import { MANAGE_COMMENTS_THREAD_POLL_MS } from '@/6-0-social-media-manage-comments/lib/manageCommentsPolling';
import { sortCommentsForThread } from '@/6-0-social-media-manage-comments/lib/sortCommentsForThread';
import {
  useThreadsContentCommentMutations,
  useThreadsContentCommentsQuery,
} from '@/threads-content/hooks/useThreadsContentComments';
import { missingScopesForFeature } from '@/meta-platform/constants/metaOAuthScopes';
import type { ThreadsContentAccountRow } from '@/threads-content/hooks/useThreadsContentSettings';

type ThreadsCommentThreadPanelProps = {
  organizationId: string;
  accountId: string;
  account: ThreadsContentAccountRow | null;
  post: ManageCommentsPostListItem | null;
  connectPath: string;
};

function threadsCommentCreateTime(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

export function ThreadsCommentThreadPanel({
  organizationId,
  accountId,
  account,
  post,
  connectPath,
}: ThreadsCommentThreadPanelProps) {
  const { t } = useTranslation();
  const mediaId = post?.id ?? null;
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);

  const commentsScopesGranted = useMemo(() => {
    if (!account) return false;
    return missingScopesForFeature(account.granted_scopes ?? [], 'threads_replies').length === 0;
  }, [account]);

  const commentsQuery = useThreadsContentCommentsQuery({
    organizationId,
    accountId,
    mediaId,
    enabled: Boolean(mediaId && commentsScopesGranted),
    refetchIntervalMs: MANAGE_COMMENTS_THREAD_POLL_MS,
  });

  const { replyMutation } = useThreadsContentCommentMutations({
    organizationId,
    accountId,
    mediaId,
  });

  useEffect(() => {
    setReplyToCommentId(null);
  }, [mediaId]);

  const handleSubmitReply = useCallback(
    async (parentCommentId: string, text: string) => {
      try {
        await replyMutation.mutateAsync({ commentId: parentCommentId, text });
        toast.success(t('digitalMarketing.manageComments.replyPosted', 'Reply posted'));
        void commentsQuery.refetch();
        setReplyToCommentId(null);
      } catch (e) {
        toast.error((e as Error)?.message ?? t('digitalMarketing.manageComments.replyFailed', 'Reply failed'));
        throw e;
      }
    },
    [replyMutation, commentsQuery, t],
  );

  const replyControls: ManageCommentsReplyControls = useMemo(
    () => ({
      replyToCommentId,
      onReply: (commentId) => setReplyToCommentId(commentId),
      onCancelReply: () => setReplyToCommentId(null),
      onSubmitReply: (parentCommentId, text) => handleSubmitReply(parentCommentId, text),
      accountLabel: post?.accountLabel ?? 'Threads',
      accountAvatarUrl: post?.accountAvatarUrl,
      isSubmittingReply: replyMutation.isPending,
      getOptimisticForParent: () => [],
      pruneOptimisticForParent: () => {},
    }),
    [replyToCommentId, handleSubmitReply, post?.accountLabel, post?.accountAvatarUrl, replyMutation.isPending],
  );

  const comments = useMemo(() => commentsQuery.data?.comments ?? [], [commentsQuery.data?.comments]);

  const displayComments = useMemo(() => {
    const withTime = comments.map((c) => ({
      ...c,
      create_time: threadsCommentCreateTime(c.published_at),
    }));
    return sortCommentsForThread(withTime, 'newest', new Set());
  }, [comments]);

  if (!post) {
    return (
      <ManageCommentsEmptyState
        title={t('digitalMarketing.manageComments.selectPost', 'Select a post')}
        description={t(
          'digitalMarketing.manageComments.selectPostHint',
          'Choose a post from the list to view and reply to comments.',
        )}
      />
    );
  }

  if (!commentsScopesGranted) {
    return (
      <Alert variant="destructive">
        <AlertTitle>
          {t('digitalMarketing.threadsContent.commentsScopeMissingTitle', 'Threads replies permission required')}
        </AlertTitle>
        <AlertDescription>
          {t(
            'digitalMarketing.threadsContent.commentsScopeMissingHint',
            'Reconnect Instagram to grant Threads reply permissions.',
          )}{' '}
          <Link to={connectPath} className="underline">
            {t('digitalMarketing.threadsContent.openConnect', 'Connect Instagram / Threads')}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (!mediaId) return <ManageCommentsEmptyState />;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ManageCommentsThreadHeader
        post={post}
        openOnPlatform="threads"
        onRefresh={() => void commentsQuery.refetch()}
        isRefreshing={commentsQuery.isFetching}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/60 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto w-full max-w-[680px] px-4">
          <MetaCommentPostPreview key={post.id} post={post} />
          <div className="mt-4">
            {commentsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : commentsQuery.isError ? (
              <div className="px-4 py-4">
                <Alert variant="destructive">
                  <AlertTitle>
                    {t('digitalMarketing.manageComments.loadCommentsError', 'Failed to load comments')}
                  </AlertTitle>
                  <AlertDescription>{(commentsQuery.error as Error)?.message}</AlertDescription>
                </Alert>
              </div>
            ) : displayComments.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {t(
                    'digitalMarketing.manageComments.noCommentsOnPost',
                    'There are no user comments on this post yet.',
                  )}
                </p>
              </div>
            ) : (
              displayComments.map((comment) => (
                <ThreadsCommentItem
                  key={comment.id}
                  comment={comment}
                  organizationId={organizationId}
                  accountId={accountId}
                  mediaId={mediaId}
                  replyControls={replyControls}
                  isMutating={replyMutation.isPending}
                />
              ))
            )}
          </div>
          <div className="h-2 flex-shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}
