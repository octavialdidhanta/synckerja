import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { ManageCommentsEmptyState } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsEmptyState";
import { ManageCommentsThreadHeader } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsThreadHeader";
import { TikTokCommentItem } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokCommentItem";
import { TikTokCommentPostPreview } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokCommentPostPreview";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";
import type { OptimisticCommentReply } from "@/6-0-social-media-manage-comments/types/manageCommentsOptimisticTypes";
import type { ManageCommentsReplyControls } from "@/6-0-social-media-manage-comments/types/manageCommentsReplyControls";
import { useTikTokContentCommentsQuery } from "@/tiktok-content/hooks/useTikTokContentCommentsQuery";
import { useTikTokContentCommentMutations } from "@/tiktok-content/hooks/useTikTokContentCommentMutations";
import { useRefetchOnTabVisible } from "@/6-0-social-media-manage-comments/hooks/useRefetchOnTabVisible";
import { useNewInboundCommentHighlights } from "@/6-0-social-media-manage-comments/hooks/useNewInboundCommentHighlights";
import {
  useManageCommentsInboxState,
  useSyncManageCommentsInboundComments,
} from "@/6-0-social-media-manage-comments/hooks/useManageCommentsInboxState";
import { MANAGE_COMMENTS_THREAD_POLL_MS } from "@/6-0-social-media-manage-comments/lib/manageCommentsPolling";
import { sortCommentsForThread } from "@/6-0-social-media-manage-comments/lib/sortCommentsForThread";
import {
  appendReplyToCache,
  buildOptimisticReplyRow,
  burstRefetchRepliesUntilFound,
  tiktokCommentRepliesQueryKey,
} from "@/6-0-social-media-manage-comments/lib/tiktokReplyCache";
import { isOwnTikTokAccountComment } from "@/6-0-social-media-manage-comments/lib/isOwnTikTokAccountComment";
import { TIKTOK_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH } from "@/tiktok-content/settings/tiktokContentSettingsPaths";
import type { TikTokCommentRow } from "@/tiktok-content/types/tiktokCommentApiTypes";

type TikTokCommentThreadPanelProps = {
  organizationId: string;
  openId: string;
  post: ManageCommentsPostListItem | null;
  commentsScopesGranted: boolean;
  postHighlightActive?: boolean;
  onNewInboundComments?: () => void;
  onPostHighlightResolved?: (postId: string) => void;
};

export function TikTokCommentThreadPanel({
  organizationId,
  openId,
  post,
  commentsScopesGranted,
  postHighlightActive = false,
  onNewInboundComments,
  onPostHighlightResolved,
}: TikTokCommentThreadPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [optimisticReplies, setOptimisticReplies] = useState<OptimisticCommentReply[]>([]);

  const videoId = post?.id ?? null;

  const commentsQuery = useTikTokContentCommentsQuery({
    organizationId,
    openId,
    videoId,
    sort: "newest",
    enabled: Boolean(post) && commentsScopesGranted,
    refetchIntervalMs: MANAGE_COMMENTS_THREAD_POLL_MS,
  });

  const { replyComment, hideComment, deleteComment, likeComment } = useTikTokContentCommentMutations({
    organizationId,
    openId,
    videoId,
  });

  const refetchComments = useCallback(
    () => commentsQuery.refetch(),
    [commentsQuery.refetch],
  );
  useRefetchOnTabVisible(refetchComments);

  useEffect(() => {
    setReplyToCommentId(null);
    setOptimisticReplies([]);
  }, [videoId]);

  const isMutating =
    replyComment.isPending
    || hideComment.isPending
    || deleteComment.isPending
    || likeComment.isPending;

  const comments = useMemo(
    () => commentsQuery.data?.comments ?? [],
    [commentsQuery.data?.comments],
  );

  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const commentsReady = commentsQuery.isFetched && !commentsQuery.isLoading;

  const { syncInboundCommentsMutation, invalidateInboxState } = useManageCommentsInboxState({
    organizationId,
    openId,
    activeVideoId: videoId,
    enabled: Boolean(post) && commentsScopesGranted,
  });

  useSyncManageCommentsInboundComments({
    organizationId,
    openId,
    videoId,
    commentIds,
    commentsReady,
    enabled: Boolean(post) && commentsScopesGranted,
    syncInboundComments: syncInboundCommentsMutation,
  });

  const { pinnedIds, highlightedIds, dismissHighlight, removeComment } =
    useNewInboundCommentHighlights(openId, videoId);

  const hadCommentHighlightsRef = useRef(false);

  useEffect(() => {
    hadCommentHighlightsRef.current = false;
  }, [videoId]);

  const prevThreadHighlightCountRef = useRef(0);
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
        dismissHighlight(commentId);
      }
      invalidateInboxState();
      const remaining = wasHighlighted ? highlightedIds.size - 1 : highlightedIds.size;
      if (wasHighlighted || postHighlightActive) {
        resolvePostHighlightIfNeeded(post.id, remaining);
      }
    },
    [
      post?.id,
      highlightedIds,
      dismissHighlight,
      postHighlightActive,
      resolvePostHighlightIfNeeded,
      invalidateInboxState,
    ],
  );

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

  const displayComments = useMemo(
    () => sortCommentsForThread(comments, "newest", pinnedIds),
    [comments, pinnedIds],
  );

  const prevHighlightCountRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const count = highlightedIds.size;
    if (count > prevHighlightCountRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    prevHighlightCountRef.current = count;
  }, [highlightedIds]);

  const getOptimisticForParent = useCallback(
    (parentCommentId: string) =>
      optimisticReplies.filter((r) => r.parentCommentId === parentCommentId),
    [optimisticReplies],
  );

  const handleHideComment = useCallback(
    async (commentId: string) => {
      try {
        await hideComment.mutateAsync(commentId);
        removeComment(commentId);
        markCommentEngaged(commentId);
        toast.success(
          t("digitalMarketing.manageComments.hideSuccess", "Comment hidden"),
        );
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [hideComment, removeComment, markCommentEngaged, t],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string, parentCommentId?: string | null) => {
      try {
        await deleteComment.mutateAsync({ commentId, parentCommentId });
        removeComment(commentId);
        markCommentEngaged(commentId);
        toast.success(
          t("digitalMarketing.manageComments.deleteSuccess", "Comment deleted"),
        );
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [deleteComment, removeComment, markCommentEngaged, t],
  );

  const handleLike = useCallback(
    async (commentId: string) => {
      try {
        await likeComment.mutateAsync({ commentId });
        markCommentEngaged(commentId);
        toast.success(
          t("digitalMarketing.manageComments.likeSuccess", "Comment liked"),
        );
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [likeComment, markCommentEngaged, t],
  );

  const pruneOptimisticForParent = useCallback(
    (parentCommentId: string, serverTexts: string[]) => {
      const normalized = new Set(serverTexts.map((s) => s.trim()));
      setOptimisticReplies((prev) =>
        prev.filter((r) => {
          if (r.parentCommentId !== parentCommentId) return true;
          if (r.status === "failed") return true;
          return !normalized.has(r.text.trim());
        }),
      );
    },
    [],
  );

  const handleSubmitReply = useCallback(
    async (parentCommentId: string, text: string, mentionLabel: string) => {
      if (!post || !videoId) return;
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
          status: "posting",
          createdAt: Date.now(),
        },
      ]);

      try {
        const result = await replyComment.mutateAsync({ text, commentId: parentCommentId });
        const repliesKey = tiktokCommentRepliesQueryKey(
          organizationId,
          openId,
          videoId,
          parentCommentId,
        );

        if (result.comment_id) {
          appendReplyToCache(
            queryClient,
            repliesKey,
            buildOptimisticReplyRow({
              commentId: result.comment_id,
              text,
              accountLabel: post.accountLabel,
              parentCommentId,
            }),
          );
          setOptimisticReplies((prev) => prev.filter((r) => r.tempId !== tempId));
        } else {
          void burstRefetchRepliesUntilFound({
            queryClient,
            organizationId,
            openId,
            videoId,
            parentCommentId,
            text,
            onFound: (serverTexts) => pruneOptimisticForParent(parentCommentId, serverTexts),
          }).then((found) => {
            if (found) {
              setOptimisticReplies((prev) => prev.filter((r) => r.tempId !== tempId));
            }
          });
        }

        toast.success(
          t("digitalMarketing.manageComments.replyPosted", "Reply posted"),
        );
        markCommentEngaged(parentCommentId);
      } catch (e) {
        setOptimisticReplies((prev) =>
          prev.map((r) =>
            r.tempId === tempId ? { ...r, status: "failed" as const } : r,
          ),
        );
        toast.error((e as Error).message);
        throw e;
      }
    },
    [post, videoId, replyComment, queryClient, organizationId, openId, t, pruneOptimisticForParent, markCommentEngaged],
  );

  const replyControls: ManageCommentsReplyControls = useMemo(
    () => ({
      replyToCommentId,
      onReply: (commentId) => setReplyToCommentId(commentId),
      onCancelReply: () => setReplyToCommentId(null),
      onSubmitReply: handleSubmitReply,
      accountLabel: post?.accountLabel ?? "TikTok",
      accountAvatarUrl: post?.accountAvatarUrl,
      isSubmittingReply: replyComment.isPending,
      getOptimisticForParent,
      pruneOptimisticForParent,
    }),
    [
      replyToCommentId,
      handleSubmitReply,
      post?.accountLabel,
      post?.accountAvatarUrl,
      replyComment.isPending,
      getOptimisticForParent,
      pruneOptimisticForParent,
    ],
  );

  const needsBusinessReconnect = useMemo(() => {
    const msg = (commentsQuery.error as Error | undefined)?.message?.toLowerCase() ?? "";
    return msg.includes("business_comment_auth_required");
  }, [commentsQuery.error]);

  if (!post) {
    return <ManageCommentsEmptyState />;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ManageCommentsThreadHeader
        post={post}
        onRefresh={() => void commentsQuery.refetch()}
        isRefreshing={commentsQuery.isFetching}
      />
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/60 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="mx-auto w-full max-w-[680px] px-4">
          <TikTokCommentPostPreview key={post.id} post={post} />
          <div className="mt-4">
          {commentsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : commentsQuery.isError ? (
            <div className="px-4 py-4">
              <Alert variant="destructive">
                <AlertTitle>
                  {t("digitalMarketing.manageComments.loadCommentsError", "Failed to load comments")}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{(commentsQuery.error as Error)?.message}</p>
                  {needsBusinessReconnect ? (
                    <p>
                      <Link
                        to={TIKTOK_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH}
                        className="font-medium text-primary underline"
                      >
                        {t("digitalMarketing.tiktokContent.openSettings", "Open settings")}
                      </Link>
                      {" — "}
                      {t(
                        "digitalMarketing.manageComments.reconnectSteps",
                        "Disconnect, then Connect (browser must open business-api.tiktok.com).",
                      )}
                    </p>
                  ) : null}
                </AlertDescription>
              </Alert>
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t(
                  "digitalMarketing.manageComments.noCommentsOnPost",
                  "There are no user comments on this post yet.",
                )}
              </p>
            </div>
          ) : (
            displayComments.map((comment) => (
              <TikTokCommentItem
                key={comment.id}
                comment={comment}
                organizationId={organizationId}
                openId={openId}
                videoId={post.id}
                replyControls={replyControls}
                isNew={highlightedIds.has(comment.id)}
                highlightedIds={highlightedIds}
                onHide={handleHideComment}
                onDelete={handleDeleteComment}
                onLike={handleLike}
                isMutating={isMutating}
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

TikTokCommentThreadPanel.displayName = "TikTokCommentThreadPanel";
