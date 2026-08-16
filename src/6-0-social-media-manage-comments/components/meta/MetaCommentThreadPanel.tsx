import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { ManageCommentsEmptyState } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsEmptyState';
import { ManageCommentsThreadHeader } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsThreadHeader';
import { MetaCommentPostPreview } from '@/6-0-social-media-manage-comments/components/meta/MetaCommentPostPreview';
import { MetaCommentItem } from '@/6-0-social-media-manage-comments/components/meta/MetaCommentItem';
import type { ManageCommentsReplyControls } from '@/6-0-social-media-manage-comments/types/manageCommentsReplyControls';
import type { ManageCommentsPostListItem } from '@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes';
import { MANAGE_COMMENTS_THREAD_POLL_MS } from '@/6-0-social-media-manage-comments/lib/manageCommentsPolling';
import { useLeadMagnetAutoCommentReplies } from '@/6-0-social-media-manage-comments/hooks/useLeadMagnetAutoCommentReplies';
import { sortCommentsForThread } from '@/6-0-social-media-manage-comments/lib/sortCommentsForThread';
import { useNewInboundCommentHighlights } from '@/6-0-social-media-manage-comments/hooks/useNewInboundCommentHighlights';
import {
  useMetaManageCommentsInboxState,
  useSyncMetaManageCommentsInboundComments,
} from '@/6-0-social-media-manage-comments/hooks/useMetaManageCommentsInboxState';
import type { MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';
import {
  useMetaContentCommentMutations,
  useMetaContentCommentsQuery,
} from '@/meta-content/hooks/useMetaContentComments';

type MetaCommentThreadPanelProps = {
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
  post: ManageCommentsPostListItem | null;
  commentsScopesGranted: boolean;
  connectPath: string;
  postHighlightActive?: boolean;
  onNewInboundComments?: () => void;
  onPostHighlightResolved?: (postId: string) => void;
  inboxEnabled?: boolean;
};

function metaCommentCreateTime(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

export function MetaCommentThreadPanel({
  organizationId,
  platform,
  accountId,
  post,
  commentsScopesGranted,
  connectPath,
  postHighlightActive = false,
  onNewInboundComments,
  onPostHighlightResolved,
  inboxEnabled = false,
}: MetaCommentThreadPanelProps) {
  const { t } = useTranslation();
  const mediaId = post?.id ?? null;
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hadCommentHighlightsRef = useRef(false);
  const markedReadRef = useRef(new Set<string>());
  const prevThreadHighlightCountRef = useRef(0);
  const prevHighlightCountRef = useRef(0);

  const commentsQuery = useMetaContentCommentsQuery({
    organizationId,
    platform,
    accountId,
    mediaId,
    enabled: Boolean(mediaId && commentsScopesGranted),
    refetchIntervalMs: MANAGE_COMMENTS_THREAD_POLL_MS,
  });

  const autoRepliesQuery = useLeadMagnetAutoCommentReplies({
    organizationId,
    platform,
    mediaId,
    enabled: Boolean(mediaId && commentsScopesGranted),
  });

  const { replyMutation } = useMetaContentCommentMutations({
    organizationId,
    platform,
    accountId,
    mediaId,
  });

  const {
    syncInboundCommentsMutation,
    markCommentReadMutation,
  } = useMetaManageCommentsInboxState({
    organizationId,
    platform,
    accountId,
    activeMediaId: mediaId,
    enabled: inboxEnabled && Boolean(post),
  });

  const comments = useMemo(
    () => commentsQuery.data?.comments ?? [],
    [commentsQuery.data?.comments],
  );
  const autoRepliesByCommentId = autoRepliesQuery.data ?? {};
  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const commentsReady = commentsQuery.isFetched && !commentsQuery.isLoading;

  useSyncMetaManageCommentsInboundComments({
    organizationId,
    platform,
    accountId,
    mediaId,
    commentIds,
    commentsReady,
    enabled: inboxEnabled && Boolean(post) && commentsScopesGranted,
    syncInboundComments: syncInboundCommentsMutation,
  });

  const { pinnedIds, highlightedIds, dismissHighlight } = useNewInboundCommentHighlights(
    accountId,
    mediaId,
  );

  useEffect(() => {
    hadCommentHighlightsRef.current = false;
    markedReadRef.current.clear();
    prevThreadHighlightCountRef.current = 0;
    prevHighlightCountRef.current = 0;
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
      if (!post?.id || !inboxEnabled) return;
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
        return;
      }
      if (!wasHighlighted && postHighlightActive) {
        resolvePostHighlightIfNeeded(post.id, highlightedIds.size);
      }
    },
    [
      post?.id,
      inboxEnabled,
      highlightedIds,
      dismissHighlight,
      markCommentReadMutation,
      resolvePostHighlightIfNeeded,
      postHighlightActive,
    ],
  );

  const highlightedIdsKey = useMemo(
    () => [...highlightedIds].sort().join(','),
    [highlightedIds],
  );
  const autoEngagedMediaRef = useRef<string | null>(null);

  useEffect(() => {
    autoEngagedMediaRef.current = null;
  }, [mediaId]);

  useEffect(() => {
    if (!inboxEnabled || !post?.id || !commentsReady || !highlightedIdsKey) return;
    if (autoEngagedMediaRef.current === post.id) return;
    autoEngagedMediaRef.current = post.id;
    for (const commentId of highlightedIdsKey.split(',')) {
      if (commentId) markCommentEngaged(commentId);
    }
  }, [post?.id, commentsReady, highlightedIdsKey, markCommentEngaged, inboxEnabled]);

  useEffect(() => {
    if (!inboxEnabled || !post?.id || highlightedIds.size > 0 || !hadCommentHighlightsRef.current) {
      return;
    }
    hadCommentHighlightsRef.current = false;
    onPostHighlightResolved?.(post.id);
  }, [highlightedIds.size, post?.id, onPostHighlightResolved, inboxEnabled]);

  useEffect(() => {
    if (!inboxEnabled || !post?.id || !commentsReady || !postHighlightActive) return;
    if (comments.length > 0 || highlightedIds.size > 0) return;
    onPostHighlightResolved?.(post.id);
  }, [
    post?.id,
    commentsReady,
    comments.length,
    postHighlightActive,
    highlightedIds.size,
    onPostHighlightResolved,
    inboxEnabled,
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
      accountLabel: post?.accountLabel ?? (platform === 'instagram' ? 'Instagram' : 'Facebook'),
      accountAvatarUrl: post?.accountAvatarUrl,
      isSubmittingReply: replyMutation.isPending,
      getOptimisticForParent: () => [],
      pruneOptimisticForParent: () => {},
    }),
    [
      replyToCommentId,
      handleSubmitReply,
      post?.accountLabel,
      post?.accountAvatarUrl,
      platform,
      replyMutation.isPending,
    ],
  );

  const displayComments = useMemo(() => {
    const withTime = comments.map((c) => ({
      ...c,
      create_time: metaCommentCreateTime(c.published_at),
    }));
    const pinned = inboxEnabled ? pinnedIds : new Set<string>();
    return sortCommentsForThread(withTime, 'newest', pinned);
  }, [comments, pinnedIds, inboxEnabled]);

  const isMutating = replyMutation.isPending;

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
          {t('metaPlatform.comments.scopeMissingTitle', 'Comments permission required')}
        </AlertTitle>
        <AlertDescription>
          {t(
            'metaPlatform.comments.scopeMissingHint',
            'Reconnect Instagram/Facebook in integrations to grant instagram_manage_comments or pages_manage_engagement.',
          )}{' '}
          <Link to={connectPath} className="underline">
            {t('metaPlatform.comments.openConnect', 'Open Connect')}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (!mediaId) {
    return <ManageCommentsEmptyState />;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ManageCommentsThreadHeader
        post={post}
        openOnPlatform={platform}
        onRefresh={() => {
          setManualRefreshing(true);
          void commentsQuery.refetch().finally(() => setManualRefreshing(false));
        }}
        isRefreshing={manualRefreshing}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
      <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-gray-100 bg-white p-3 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <MetaCommentPostPreview key={post.id} post={post} compact />
      </aside>
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/60 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="mx-auto w-full max-w-[680px] px-4 pt-4">
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
                <MetaCommentItem
                  key={comment.id}
                  comment={comment}
                  organizationId={organizationId}
                  platform={platform}
                  accountId={accountId}
                  mediaId={mediaId}
                  replyControls={replyControls}
                  autoReply={autoRepliesByCommentId[comment.id] ?? null}
                  isMutating={isMutating}
                  isNew={inboxEnabled && highlightedIds.has(comment.id)}
                />
              ))
            )}
          <div className="h-2 flex-shrink-0" aria-hidden />
        </div>
      </div>
      </div>
    </div>
  );
}
