import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Link } from "react-router-dom";

import { Loader2 } from "lucide-react";

import { useTranslation } from "react-i18next";

import { useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";

import { ManageCommentsEmptyState } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsEmptyState";

import { ManageCommentsThreadHeader } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsThreadHeader";

import { YouTubeCommentItem } from "@/6-0-social-media-manage-comments/components/youtube/YouTubeCommentItem";

import { YouTubeCommentPostPreview } from "@/6-0-social-media-manage-comments/components/youtube/YouTubeCommentPostPreview";
import { ManageCommentsInlineReplyComposer } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsInlineReplyComposer";
import { useManageCommentsMobileLayout } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsMobileLayoutContext";

import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

import type { OptimisticCommentReply } from "@/6-0-social-media-manage-comments/types/manageCommentsOptimisticTypes";

import type { ManageCommentsReplyControls } from "@/6-0-social-media-manage-comments/types/manageCommentsReplyControls";

import { useYouTubeContentCommentsQuery } from "@/youtube-content/hooks/useYouTubeContentCommentsQuery";

import { useYouTubeContentCommentMutations } from "@/youtube-content/hooks/useYouTubeContentCommentMutations";

import type { YouTubeCommentsListResponse } from "@/youtube-content/types/youtubeCommentApiTypes";

import { useRefetchOnTabVisible } from "@/6-0-social-media-manage-comments/hooks/useRefetchOnTabVisible";

import { useNewInboundCommentHighlights } from "@/6-0-social-media-manage-comments/hooks/useNewInboundCommentHighlights";

import {

  useSyncYouTubeManageCommentsInboundComments,

  useYouTubeManageCommentsInboxState,

} from "@/6-0-social-media-manage-comments/hooks/useYouTubeManageCommentsInboxState";

import { YOUTUBE_MANAGE_COMMENTS_THREAD_POLL_MS } from "@/6-0-social-media-manage-comments/lib/manageCommentsPolling";

import { sortCommentsForThread } from "@/6-0-social-media-manage-comments/lib/sortCommentsForThread";

import {

  appendYouTubeReplyToCache,

  buildOptimisticYouTubeReplyRow,

  burstRefetchYouTubeRepliesUntilFound,

  patchYouTubeCommentPostsCount,

  youtubeCommentRepliesQueryKey,

} from "@/6-0-social-media-manage-comments/lib/youtubeReplyCache";

import { sumYouTubeTopLevelCommentActivity } from "@/youtube-content/lib/youtubeCommentActivityCount";

import { YOUTUBE_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH } from "@/youtube-content/settings/youtubeContentSettingsPaths";



type YouTubeCommentThreadPanelProps = {

  organizationId: string;

  channelId: string;

  post: ManageCommentsPostListItem | null;

  commentsScopesGranted: boolean;

  postHighlightActive?: boolean;

  onNewInboundComments?: () => void;

  onPostHighlightResolved?: (postId: string) => void;

};



export function YouTubeCommentThreadPanel({

  organizationId,

  channelId,

  post,

  commentsScopesGranted,

  postHighlightActive = false,

  onNewInboundComments,

  onPostHighlightResolved,

}: YouTubeCommentThreadPanelProps) {

  const { t } = useTranslation();
  const isMobileLayout = useManageCommentsMobileLayout();

  const queryClient = useQueryClient();

  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);

  const [optimisticReplies, setOptimisticReplies] = useState<OptimisticCommentReply[]>([]);

  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Set<string>>(() => new Set());

  const videoId = post?.id ?? null;



  const commentsQuery = useYouTubeContentCommentsQuery({

    organizationId,

    channelId,

    videoId,

    sort: "newest",

    enabled: Boolean(post) && commentsScopesGranted,

    refetchIntervalMs: YOUTUBE_MANAGE_COMMENTS_THREAD_POLL_MS,

  });



  const { replyComment, insertComment } = useYouTubeContentCommentMutations({

    organizationId,

    channelId,

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



  const isMutating = replyComment.isPending || insertComment.isPending;



  const comments = useMemo(

    () => commentsQuery.data?.comments ?? [],

    [commentsQuery.data?.comments],

  );

  const liveCommentCount = useMemo(
    () => sumYouTubeTopLevelCommentActivity(comments),
    [comments],
  );

  const displayPost = useMemo((): ManageCommentsPostListItem | null => {
    if (!post) return null;
    if (liveCommentCount <= 0) return post;
    return {
      ...post,
      commentCount: Math.max(post.commentCount, liveCommentCount),
    };
  }, [post, liveCommentCount]);

  useEffect(() => {
    if (!organizationId || !channelId || !videoId || liveCommentCount <= 0) return;
    patchYouTubeCommentPostsCount(
      queryClient,
      organizationId,
      channelId,
      videoId,
      liveCommentCount,
    );
  }, [organizationId, channelId, videoId, liveCommentCount, queryClient]);



  const accountLabel =

    post?.accountLabel?.trim()

    || commentsQuery.data?.account_label?.trim()

    || "YouTube";



  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);

  const commentsReady = commentsQuery.isFetched && !commentsQuery.isLoading;



  const {

    syncInboundCommentsMutation,

    markCommentReadMutation,

    invalidateInboxState,

  } = useYouTubeManageCommentsInboxState({

    organizationId,

    channelId,

    activeVideoId: videoId,

    enabled: Boolean(post) && commentsScopesGranted,

  });



  useSyncYouTubeManageCommentsInboundComments({

    organizationId,

    channelId,

    videoId,

    commentIds,

    commentsReady,

    enabled: Boolean(post) && commentsScopesGranted,

    syncInboundComments: syncInboundCommentsMutation,

  });



  const { pinnedIds, highlightedIds, dismissHighlight } =

    useNewInboundCommentHighlights(channelId, videoId);



  const hadCommentHighlightsRef = useRef(false);

  const markedReadRef = useRef(new Set<string>());



  useEffect(() => {

    hadCommentHighlightsRef.current = false;

    markedReadRef.current = new Set();

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

        if (markedReadRef.current.has(commentId)) return;

        markedReadRef.current.add(commentId);

        dismissHighlight(commentId);

        void markCommentReadMutation

          .mutateAsync({ videoId: post.id, commentId })

          .catch(() => {

            markedReadRef.current.delete(commentId);

          });

        const remaining = highlightedIds.size - 1;

        resolvePostHighlightIfNeeded(post.id, remaining);

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

    () => [...highlightedIds].sort().join(","),

    [highlightedIds],

  );



  useEffect(() => {

    if (!post?.id || !commentsReady || !highlightedIdsKey) return;

    for (const commentId of highlightedIdsKey.split(",")) {

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

    async (
      parentCommentId: string,
      text: string,
      mentionLabel: string,
      replyContext?: {
        threadId?: string | null;
        targetParentCommentId?: string | null;
      },
    ) => {

      if (!post || !videoId) return;

      const repliesListParentId = (
        replyContext?.targetParentCommentId?.trim() || parentCommentId
      ).trim();

      const tempId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setExpandedReplyThreads((prev) => new Set(prev).add(repliesListParentId));

      setOptimisticReplies((prev) => [

        ...prev,

        {

          tempId,

          parentCommentId: repliesListParentId,

          text,

          accountLabel,

          accountAvatarUrl: post.accountAvatarUrl,

          mentionLabel,

          status: "posting",

          createdAt: Date.now(),

        },

      ]);



      try {

        const result = await replyComment.mutateAsync({
          text,
          commentId: parentCommentId,
          repliesListParentId,
          threadId: replyContext?.threadId,
          targetParentCommentId: replyContext?.targetParentCommentId,
        });

        const repliesKey = youtubeCommentRepliesQueryKey(

          organizationId,

          channelId,

          videoId,

          repliesListParentId,

        );



        if (result.comment_id) {

          const replyRow = result.comment
            ? result.comment
            : buildOptimisticYouTubeReplyRow({

              commentId: result.comment_id,

              text,

              accountLabel,

              parentCommentId: repliesListParentId,

              videoId,

            });

          appendYouTubeReplyToCache(

            queryClient,

            repliesKey,

            replyRow,

          );

          setOptimisticReplies((prev) => prev.filter((r) => r.tempId !== tempId));

          void burstRefetchYouTubeRepliesUntilFound({

            queryClient,

            organizationId,

            channelId,

            videoId,

            parentCommentId: repliesListParentId,

            text,

            onFound: (serverTexts) => pruneOptimisticForParent(repliesListParentId, serverTexts),

          });

        } else {

          void burstRefetchYouTubeRepliesUntilFound({

            queryClient,

            organizationId,

            channelId,

            videoId,

            parentCommentId: repliesListParentId,

            text,

            onFound: (serverTexts) => pruneOptimisticForParent(repliesListParentId, serverTexts),

          }).then((found) => {

            if (found) {

              setOptimisticReplies((prev) => prev.filter((r) => r.tempId !== tempId));

            }

          });

        }



        queryClient.setQueryData<YouTubeCommentsListResponse | null>(
          ["youtube-content-comments", organizationId, channelId, videoId, "newest"],
          (old) => {
            if (!old) return old;
            const nextComments = old.comments.map((row) =>
              row.id === repliesListParentId
                ? { ...row, reply_count: row.reply_count + 1 }
                : row,
            );
            patchYouTubeCommentPostsCount(
              queryClient,
              organizationId,
              channelId,
              videoId,
              sumYouTubeTopLevelCommentActivity(nextComments),
            );
            return {
              ...old,
              comments: nextComments,
            };
          },
        );

        toast.success(

          t("digitalMarketing.manageComments.replyPosted", "Reply posted"),

        );

        markCommentEngaged(repliesListParentId);

        setReplyToCommentId(null);

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

    [

      post,

      videoId,

      accountLabel,

      replyComment,

      queryClient,

      organizationId,

      channelId,

      t,

      pruneOptimisticForParent,

      markCommentEngaged,

    ],

  );



  const replyControls: ManageCommentsReplyControls = useMemo(

    () => ({

      replyToCommentId,

      onReply: (commentId) => setReplyToCommentId(commentId),

      onCancelReply: () => setReplyToCommentId(null),

      onSubmitReply: handleSubmitReply,

      accountLabel,

      accountAvatarUrl: post?.accountAvatarUrl,

      isSubmittingReply: replyComment.isPending,

      getOptimisticForParent,

      pruneOptimisticForParent,

    }),

    [

      replyToCommentId,

      handleSubmitReply,

      accountLabel,

      post?.accountAvatarUrl,

      replyComment.isPending,

      getOptimisticForParent,

      pruneOptimisticForParent,

    ],

  );


  const handleInsertComment = useCallback(
    async (text: string) => {
      try {
        await insertComment.mutateAsync({ text });
        toast.success(t("digitalMarketing.manageComments.commentPosted", "Comment posted"));
      } catch (e) {
        toast.error((e as Error).message);
        throw e;
      }
    },
    [insertComment, t],
  );

  const needsReconnect = useMemo(() => {

    const msg = (commentsQuery.error as Error | undefined)?.message?.toLowerCase() ?? "";

    return msg.includes("youtube_comments_forbidden") || msg.includes("youtube.force-ssl");

  }, [commentsQuery.error]);



  const wrongChannel = useMemo(() => {

    const msg = (commentsQuery.error as Error | undefined)?.message?.toLowerCase() ?? "";

    return msg.includes("youtube_comments_wrong_channel");

  }, [commentsQuery.error]);



  const commentsDisabled = useMemo(() => {

    const msg = (commentsQuery.error as Error | undefined)?.message?.toLowerCase() ?? "";

    return msg.includes("youtube_comments_disabled");

  }, [commentsQuery.error]);



  const quotaExceeded = useMemo(() => {

    const msg = (commentsQuery.error as Error | undefined)?.message?.toLowerCase() ?? "";

    return msg.includes("youtube_comments_quota");

  }, [commentsQuery.error]);



  if (!post) {

    return <ManageCommentsEmptyState />;

  }



  return (

    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">

      <ManageCommentsThreadHeader

        post={displayPost ?? post}

        openOnPlatform="youtube"

        onRefresh={() => void commentsQuery.refetch()}

        isRefreshing={commentsQuery.isFetching}

      />

      <div

        ref={scrollContainerRef}

        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/60 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

      >

        <div className="mx-auto w-full max-w-[680px] px-4">

          <YouTubeCommentPostPreview key={post.id} post={displayPost ?? post} />

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

                    {wrongChannel ? (

                      <p>

                        {t(

                          "digitalMarketing.manageComments.youtubeCommentsWrongChannel",

                          "This video belongs to a different connected channel. Switch channel in the left sidebar.",

                        )}

                      </p>

                    ) : null}

                    {needsReconnect ? (

                      <p>

                        {t(

                          "digitalMarketing.manageComments.youtubeCommentsForbidden",

                          "Reconnect the channel in settings and ensure the Google account owns this YouTube channel.",

                        )}{" "}

                        <Link

                          to={YOUTUBE_CONTENT_MANAGE_COMMENTS_SETTINGS_PATH}

                          className="font-medium text-primary underline"

                        >

                          {t("digitalMarketing.youtubeContent.openSettings", "Open settings")}

                        </Link>

                      </p>

                    ) : null}

                    {commentsDisabled ? (

                      <p>

                        {t(

                          "digitalMarketing.manageComments.youtubeCommentsDisabled",

                          "Comments are turned off for this video on YouTube.",

                        )}

                      </p>

                    ) : null}

                    {quotaExceeded ? (

                      <p>

                        {t(

                          "digitalMarketing.manageComments.youtubeCommentsQuota",

                          "YouTube API quota was exceeded. Wait a few minutes and refresh, or check quota in Google Cloud Console.",

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

                <YouTubeCommentItem

                  key={comment.id}

                  comment={comment}

                  organizationId={organizationId}

                  channelId={channelId}

                  videoId={post.id}

                  replyControls={replyControls}

                  isMutating={isMutating}

                  isNew={highlightedIds.has(comment.id)}

                  forceRepliesExpanded={expandedReplyThreads.has(comment.id)}

                  highlightedIds={highlightedIds}

                />

              ))

            )}

          </div>

          <div className="h-2 flex-shrink-0" aria-hidden />

        </div>

      </div>

      {isMobileLayout && commentsScopesGranted && !commentsQuery.isError ? (
        <div className="shrink-0 border-t border-border bg-background px-3 py-2">
          <ManageCommentsInlineReplyComposer
            accountLabel={accountLabel}
            accountAvatarUrl={post.accountAvatarUrl}
            isSubmitting={insertComment.isPending}
            autoFocus={false}
            maxLength={5000}
            className="mt-0"
            placeholder={t("digitalMarketing.manageComments.writeCommentPlaceholder", {
              name: accountLabel,
              defaultValue: `Write a comment as ${accountLabel}`,
            })}
            onSubmit={handleInsertComment}
          />
        </div>
      ) : null}

    </div>

  );

}



YouTubeCommentThreadPanel.displayName = "YouTubeCommentThreadPanel";

