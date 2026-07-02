import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { ManageCommentsEmptyState } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsEmptyState';
import { ManageCommentsThreadHeader } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsThreadHeader';
import { MetaCommentPostPreview } from '@/6-0-social-media-manage-comments/components/meta/MetaCommentPostPreview';
import { ThreadsCommentItem } from '@/6-0-social-media-manage-comments/components/threads/ThreadsCommentItem';
import type { ManageCommentsReplyControls } from '@/6-0-social-media-manage-comments/types/manageCommentsReplyControls';
import type { OptimisticCommentReply } from '@/6-0-social-media-manage-comments/types/manageCommentsOptimisticTypes';
import type { ManageCommentsPostListItem } from '@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes';
import { MANAGE_COMMENTS_THREAD_POLL_MS } from '@/6-0-social-media-manage-comments/lib/manageCommentsPolling';
import { sortCommentsForThread } from '@/6-0-social-media-manage-comments/lib/sortCommentsForThread';
import { useNewInboundCommentHighlights } from '@/6-0-social-media-manage-comments/hooks/useNewInboundCommentHighlights';
import {
  useSyncThreadsManageCommentsInboundComments,
  useThreadsManageCommentsInboxState,
} from '@/6-0-social-media-manage-comments/hooks/useThreadsManageCommentsInboxState';
import {
  buildThreadsOptimisticReplyRow,
  bumpThreadsParentReplyCountInCache,
  burstRefetchThreadsRepliesUntilFound,
  pruneThreadsLocalRepliesForParent,
} from '@/6-0-social-media-manage-comments/lib/threadsReplyCache';
import {
  patchThreadsPostCommentCountInCache,
  useThreadsContentCommentMutations,
  useThreadsContentCommentsQuery,
  type ThreadsContentCommentRow,
} from '@/threads-content/hooks/useThreadsContentComments';
import { missingScopesForFeature } from '@/meta-platform/constants/metaOAuthScopes';
import type { ThreadsContentAccountRow } from '@/threads-content/hooks/useThreadsContentSettings';

type ThreadsCommentThreadPanelProps = {
  organizationId: string;
  accountId: string;
  account: ThreadsContentAccountRow | null;
  post: ManageCommentsPostListItem | null;
  connectPath: string;
  postHighlightActive?: boolean;
  onNewInboundComments?: () => void;
  onPostHighlightResolved?: (postId: string) => void;
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
  postHighlightActive = false,
  onNewInboundComments,
  onPostHighlightResolved,
}: ThreadsCommentThreadPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mediaId = post?.id ?? null;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hadCommentHighlightsRef = useRef(false);
  const prevThreadHighlightCountRef = useRef(0);
  const prevHighlightCountRef = useRef(0);
  const markedReadRef = useRef(new Set<string>());
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [optimisticReplies, setOptimisticReplies] = useState<OptimisticCommentReply[]>([]);
  const [localRepliesByParent, setLocalRepliesByParent] = useState<
    Record<string, ThreadsContentCommentRow[]>
  >({});
  const [expandedReplyParents, setExpandedReplyParents] = useState<Set<string>>(new Set());

  const readCommentsScopesGranted = useMemo(() => {
    if (!account) return false;
    const granted = account.granted_scopes ?? [];
    const missingRead = missingScopesForFeature(granted, 'threads_replies')
      .filter((s) => s !== 'threads_content_publish');
    return missingRead.length === 0;
  }, [account]);

  const replyScopesGranted = useMemo(() => {
    if (!account) return false;
    return (account.granted_scopes ?? []).some(
      (s) => s.toLowerCase() === 'threads_content_publish',
    );
  }, [account]);

  const commentsQuery = useThreadsContentCommentsQuery({
    organizationId,
    accountId,
    mediaId,
    enabled: Boolean(mediaId && readCommentsScopesGranted),
    refetchIntervalMs: MANAGE_COMMENTS_THREAD_POLL_MS,
  });

  const { replyMutation, hideMutation, deleteMutation, editMutation } =
    useThreadsContentCommentMutations({
      organizationId,
      accountId,
      mediaId,
    });

  const isMutating =
    replyMutation.isPending ||
    hideMutation.isPending ||
    deleteMutation.isPending ||
    editMutation.isPending;

  const comments = useMemo(() => commentsQuery.data?.comments ?? [], [commentsQuery.data?.comments]);
  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const commentsReady = commentsQuery.isFetched && !commentsQuery.isLoading;

  const {
    syncInboundCommentsMutation,
    markCommentReadMutation,
    invalidateInboxState,
  } = useThreadsManageCommentsInboxState({
    organizationId,
    accountId,
    activeMediaId: mediaId,
    enabled: Boolean(post) && readCommentsScopesGranted,
  });

  useSyncThreadsManageCommentsInboundComments({
    organizationId,
    accountId,
    mediaId,
    commentIds,
    commentsReady,
    enabled: Boolean(post) && readCommentsScopesGranted,
    syncInboundComments: syncInboundCommentsMutation,
  });

  const { pinnedIds, highlightedIds, dismissHighlight } = useNewInboundCommentHighlights(
    accountId,
    mediaId,
  );

  useEffect(() => {
    hadCommentHighlightsRef.current = false;
    markedReadRef.current.clear();
  }, [mediaId]);

  useEffect(() => {
    if (highlightedIds.size > 0) {
      hadCommentHighlightsRef.current = true;
    }
    if (highlightedIds.size > prevThreadHighlightCountRef.current) {
      onNewInboundComments?.();
    }
    prevThreadHighlightCountRef.current = highlightedIds.size;
  }, [highlightedIds.size, onNewInboundComments]);

  const resolvePostHighlightIfNeeded = useCallback(
    (postId: string, remainingCommentHighlights: number) => {
      if (!postId || !onPostHighlightResolved) return;
      if (remainingCommentHighlights === 0) {
        onPostHighlightResolved(postId);
        return;
      }
      if (postHighlightActive && !hadCommentHighlightsRef.current) {
        onPostHighlightResolved(postId);
      }
    },
    [onPostHighlightResolved, postHighlightActive],
  );

  const markCommentEngaged = useCallback(
    (commentId: string) => {
      if (!post?.id) return;
      const wasHighlighted = highlightedIds.has(commentId);
      if (wasHighlighted) {
        if (markedReadRef.current.has(commentId)) return;
        markedReadRef.current.add(commentId);
        dismissHighlight(commentId);
        void markCommentReadMutation
          .mutateAsync({ mediaId: post.id, commentId })
          .catch(() => {
            markedReadRef.current.delete(commentId);
          });
        resolvePostHighlightIfNeeded(post.id, highlightedIds.size - 1);
        invalidateInboxState();
        return;
      }
      if (!wasHighlighted && postHighlightActive) {
        resolvePostHighlightIfNeeded(post.id, highlightedIds.size);
      }
    },
    [
      post?.id,
      highlightedIds,
      dismissHighlight,
      markCommentReadMutation,
      resolvePostHighlightIfNeeded,
      invalidateInboxState,
      postHighlightActive,
    ],
  );

  const highlightedIdsKey = useMemo(
    () => [...highlightedIds].sort().join(','),
    [highlightedIds],
  );

  useEffect(() => {
    if (!post?.id || !commentsReady || !highlightedIdsKey) return;
    for (const commentId of highlightedIdsKey.split(',')) {
      if (commentId) markCommentEngaged(commentId);
    }
  }, [post?.id, commentsReady, highlightedIdsKey, markCommentEngaged]);

  useEffect(() => {
    if (!post?.id || highlightedIds.size > 0 || !hadCommentHighlightsRef.current) return;
    hadCommentHighlightsRef.current = false;
    onPostHighlightResolved?.(post.id);
  }, [highlightedIds.size, post?.id, onPostHighlightResolved]);

  useEffect(() => {
    if (!post?.id || !commentsReady || !postHighlightActive) return;
    if (comments.length > 0 || highlightedIds.size > 0) return;
    onPostHighlightResolved?.(post.id);
  }, [
    post?.id,
    commentsReady,
    comments.length,
    postHighlightActive,
    highlightedIds.size,
    onPostHighlightResolved,
  ]);

  useEffect(() => {
    const count = highlightedIds.size;
    if (count > prevHighlightCountRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevHighlightCountRef.current = count;
  }, [highlightedIds]);

  useEffect(() => {
    setReplyToCommentId(null);
    setOptimisticReplies([]);
    setLocalRepliesByParent({});
    setExpandedReplyParents(new Set());
  }, [mediaId]);

  const pruneLocalRepliesForParent = useCallback(
    (parentCommentId: string, serverComments: ThreadsContentCommentRow[]) => {
      setLocalRepliesByParent((prev) =>
        pruneThreadsLocalRepliesForParent({
          localByParent: prev,
          parentCommentId,
          serverComments,
        }),
      );
    },
    [],
  );

  const pruneOptimisticForParent = useCallback((parentCommentId: string, serverTexts: string[]) => {
    const normalized = new Set(serverTexts.map((s) => s.trim()));
    setOptimisticReplies((prev) =>
      prev.filter((r) => {
        if (r.parentCommentId !== parentCommentId) return true;
        if (r.status === 'failed') return true;
        return !normalized.has(r.text.trim());
      }),
    );
  }, []);

  const handleSubmitReply = useCallback(
    async (parentCommentId: string, text: string, mentionLabel: string) => {
      if (!mediaId || !post) return;
      const tempId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setOptimisticReplies((prev) => [
        ...prev,
        {
          tempId,
          parentCommentId,
          text,
          accountLabel: post.accountLabel,
          accountAvatarUrl: post.accountAvatarUrl,
          mentionLabel,
          status: 'posting',
          createdAt: Date.now(),
        },
      ]);

      try {
        const result = await replyMutation.mutateAsync({ commentId: parentCommentId, text });
        const localRow = buildThreadsOptimisticReplyRow({
          commentId: result.comment_id?.trim() || tempId,
          text,
          accountLabel: post.accountLabel,
          mediaId,
          parentCommentId,
        });

        bumpThreadsParentReplyCountInCache({
          queryClient,
          organizationId,
          accountId,
          mediaId,
          parentCommentId,
        });

        setLocalRepliesByParent((prev) => ({
          ...prev,
          [parentCommentId]: [localRow, ...(prev[parentCommentId] ?? [])],
        }));
        setExpandedReplyParents((prev) => new Set(prev).add(parentCommentId));
        setOptimisticReplies((prev) => prev.filter((r) => r.tempId !== tempId));

        void burstRefetchThreadsRepliesUntilFound({
          queryClient,
          organizationId,
          accountId,
          mediaId,
          parentCommentId,
          text,
          onFound: (serverComments) => {
            pruneOptimisticForParent(parentCommentId, serverComments.map((c) => c.text));
            pruneLocalRepliesForParent(parentCommentId, serverComments);
          },
        });

        toast.success(t('digitalMarketing.manageComments.replyPosted', 'Reply posted'));
        setReplyToCommentId(null);
      } catch (e) {
        setOptimisticReplies((prev) =>
          prev.map((r) => (r.tempId === tempId ? { ...r, status: 'failed' as const } : r)),
        );
        toast.error((e as Error)?.message ?? t('digitalMarketing.manageComments.replyFailed', 'Reply failed'));
        throw e;
      }
    },
    [
      mediaId,
      post,
      replyMutation,
      queryClient,
      organizationId,
      accountId,
      t,
      pruneOptimisticForParent,
      pruneLocalRepliesForParent,
    ],
  );

  const getOptimisticForParent = useCallback(
    (parentCommentId: string) =>
      optimisticReplies.filter((r) => r.parentCommentId === parentCommentId),
    [optimisticReplies],
  );

  const handleHide = useCallback(
    async (commentId: string) => {
      try {
        await hideMutation.mutateAsync({ commentId });
        markCommentEngaged(commentId);
        toast.success(t('digitalMarketing.manageComments.hideSuccess', 'Comment hidden'));
      } catch (e) {
        toast.error((e as Error)?.message ?? t('digitalMarketing.manageComments.hideFailed', 'Hide failed'));
      }
    },
    [hideMutation, markCommentEngaged, t],
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      try {
        await deleteMutation.mutateAsync({ commentId });
        markCommentEngaged(commentId);
        toast.success(t('digitalMarketing.manageComments.deleteSuccess', 'Comment deleted'));
      } catch (e) {
        toast.error((e as Error)?.message ?? t('digitalMarketing.manageComments.deleteFailed', 'Delete failed'));
      }
    },
    [deleteMutation, markCommentEngaged, t],
  );

  const handleEdit = useCallback(
    async (
      commentId: string,
      parentCommentId: string,
      text: string,
      meta?: { publishedAt?: string | null; isChannelOwner?: boolean },
    ) => {
      try {
        await editMutation.mutateAsync({
          commentId,
          parentCommentId,
          text,
          publishedAt: meta?.publishedAt,
          isChannelOwner: meta?.isChannelOwner,
        });
        toast.success(t('digitalMarketing.manageComments.editSuccess', 'Comment updated'));
      } catch (e) {
        toast.error((e as Error)?.message ?? t('digitalMarketing.manageComments.editFailed', 'Edit failed'));
        throw e;
      }
    },
    [editMutation, t],
  );

  const replyControls: ManageCommentsReplyControls = useMemo(
    () => ({
      replyToCommentId,
      onReply: (commentId) => setReplyToCommentId(commentId),
      onCancelReply: () => setReplyToCommentId(null),
      onSubmitReply: (parentCommentId, text, mentionLabel) =>
        handleSubmitReply(parentCommentId, text, mentionLabel),
      accountLabel: post?.accountLabel ?? 'Threads',
      accountAvatarUrl: post?.accountAvatarUrl,
      isSubmittingReply: replyMutation.isPending,
      getOptimisticForParent,
      pruneOptimisticForParent,
    }),
    [
      replyToCommentId,
      handleSubmitReply,
      post?.accountLabel,
      post?.accountAvatarUrl,
      replyMutation.isPending,
      getOptimisticForParent,
      pruneOptimisticForParent,
    ],
  );

  const liveTopLevelCount = commentsQuery.data?.comment_count ?? comments.length;
  const liveActivityCount = commentsQuery.data?.activity_count ?? liveTopLevelCount;
  const displayPost = useMemo(() => {
    if (!post) return null;
    return {
      ...post,
      commentCount: Math.max(post.commentCount, liveTopLevelCount),
      snippet:
        liveTopLevelCount > 0
          ? `${liveTopLevelCount} comment${liveTopLevelCount === 1 ? '' : 's'}`
          : post.snippet,
    };
  }, [post, liveTopLevelCount]);

  useEffect(() => {
    if (!mediaId || !commentsQuery.isFetched || commentsQuery.isLoading) return;
    patchThreadsPostCommentCountInCache({
      queryClient,
      organizationId,
      accountId,
      mediaId,
      commentCount: liveTopLevelCount,
    });
  }, [
    queryClient,
    organizationId,
    accountId,
    mediaId,
    liveTopLevelCount,
    commentsQuery.isFetched,
    commentsQuery.isLoading,
  ]);

  const displayComments = useMemo(() => {
    const withTime = comments.map((c) => ({
      ...c,
      create_time: threadsCommentCreateTime(c.published_at),
    }));
    return sortCommentsForThread(withTime, 'newest', pinnedIds);
  }, [comments, pinnedIds]);

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

  if (!readCommentsScopesGranted) {
    return (
      <Alert variant="destructive">
        <AlertTitle>
          {t('digitalMarketing.threadsContent.commentsScopeMissingTitle', 'Threads replies permission required')}
        </AlertTitle>
        <AlertDescription>
          {t(
            'digitalMarketing.threadsContent.commentsScopeMissingHint',
            'Authorize Threads on the Connect Threads page to enable replies.',
          )}{' '}
          <Link to={connectPath} className="underline">
            {t('threadsConnect.connectButton', 'Connect Threads')}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (!mediaId) return <ManageCommentsEmptyState />;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ManageCommentsThreadHeader
        post={displayPost ?? post}
        openOnPlatform="threads"
        onRefresh={() => void commentsQuery.refetch()}
        isRefreshing={commentsQuery.isFetching}
      />
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/60 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="mx-auto w-full max-w-[680px] px-4">
          {!replyScopesGranted ? (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>
                {t(
                  'digitalMarketing.threadsContent.contentPublishMissingTitle',
                  'Reply permission required',
                )}
              </AlertTitle>
              <AlertDescription>
                {t(
                  'digitalMarketing.threadsContent.contentPublishMissingHint',
                  'Your Threads account can read comments but cannot publish replies yet. Open Connect Threads and authorize again.',
                )}{' '}
                <Link to={connectPath} className="underline">
                  {t('threadsConnect.reconnect', 'Reconnect Threads')}
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}
          <MetaCommentPostPreview key={post.id} post={displayPost ?? post} />
          {liveActivityCount > liveTopLevelCount ? (
            <p className="mt-2 px-4 text-xs text-muted-foreground">
              {t(
                'digitalMarketing.threadsContent.threadActivityHint',
                '{{topLevel}} top-level · {{total}} total in thread',
                { topLevel: liveTopLevelCount, total: liveActivityCount },
              )}
            </p>
          ) : null}
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
                  isMutating={isMutating}
                  isNew={highlightedIds.has(comment.id)}
                  highlightedIds={highlightedIds}
                  replyDisabled={!replyScopesGranted}
                  localReplies={localRepliesByParent[comment.id] ?? []}
                  forceRepliesExpanded={expandedReplyParents.has(comment.id)}
                  onServerRepliesLoaded={pruneLocalRepliesForParent}
                  onHide={handleHide}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  isSubmittingEdit={editMutation.isPending}
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
