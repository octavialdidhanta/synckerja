import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { MANAGE_COMMENTS_THREAD_POLL_MS } from "@/6-0-social-media-manage-comments/lib/manageCommentsPolling";
import { useTikTokContentCommentRepliesQuery } from "@/tiktok-content/hooks/useTikTokContentCommentsQuery";
import { TikTokCommentItem } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokCommentItem";
import { TikTokOptimisticReplyBubble } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokOptimisticReplyBubble";
import type { OptimisticCommentReply } from "@/6-0-social-media-manage-comments/types/manageCommentsOptimisticTypes";
import type { ManageCommentsReplyControls } from "@/6-0-social-media-manage-comments/types/manageCommentsReplyControls";

type TikTokCommentReplyThreadProps = {
  organizationId: string;
  openId: string;
  commentId: string;
  videoId: string;
  replyControls: ManageCommentsReplyControls;
  optimisticReplies: OptimisticCommentReply[];
  onHide: (commentId: string) => void;
  onDelete: (commentId: string, parentCommentId?: string | null) => void;
  onLike?: (commentId: string) => void;
  isMutating?: boolean;
  forceOpen?: boolean;
  highlightedIds?: Set<string>;
};

export function TikTokCommentReplyThread({
  organizationId,
  openId,
  commentId,
  videoId,
  replyControls,
  optimisticReplies,
  onHide,
  onDelete,
  onLike,
  isMutating,
  forceOpen,
  highlightedIds,
}: TikTokCommentReplyThreadProps) {
  const { t } = useTranslation();
  const shouldFetch =
    forceOpen ||
    optimisticReplies.length > 0 ||
    replyControls.replyToCommentId === commentId;

  const repliesQuery = useTikTokContentCommentRepliesQuery({
    organizationId,
    openId,
    videoId,
    commentId,
    enabled: Boolean(organizationId && openId && videoId && commentId && shouldFetch),
    refetchIntervalMs: MANAGE_COMMENTS_THREAD_POLL_MS,
  });

  const pruneOptimistic = replyControls.pruneOptimisticForParent;
  useEffect(() => {
    if (!repliesQuery.data?.comments?.length) return;
    pruneOptimistic(commentId, repliesQuery.data.comments.map((c) => c.text));
  }, [repliesQuery.data?.comments, commentId, pruneOptimistic]);

  const serverReplies = useMemo(() => {
    const rows = repliesQuery.data?.comments ?? [];
    return [...rows].sort((a, b) => (b.create_time ?? 0) - (a.create_time ?? 0));
  }, [repliesQuery.data?.comments]);

  const sortedOptimistic = useMemo(
    () => [...optimisticReplies].sort((a, b) => b.createdAt - a.createdAt),
    [optimisticReplies],
  );

  if (!shouldFetch) return null;

  const showLoading = repliesQuery.isLoading && serverReplies.length === 0 && optimisticReplies.length === 0;

  if (showLoading) {
    return (
      <div className="mt-2 flex items-center gap-2 border-l-2 border-sky-200 pl-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("digitalMarketing.manageComments.loadingReplies", "Loading replies…")}
      </div>
    );
  }

  if (serverReplies.length === 0 && optimisticReplies.length === 0) return null;

  const optimisticTexts = new Set(sortedOptimistic.map((r) => r.text.trim()));

  return (
    <div className="mt-2 space-y-1 border-l-2 border-sky-300 pl-3">
      {sortedOptimistic.map((reply) => (
        <TikTokOptimisticReplyBubble key={reply.tempId} reply={reply} nested />
      ))}
      {serverReplies
        .filter((reply) => !optimisticTexts.has(reply.text.trim()))
        .map((reply) => (
          <TikTokCommentItem
            key={reply.id}
            comment={reply}
            organizationId={organizationId}
            openId={openId}
            videoId={videoId}
            nested
            replyControls={replyControls}
            onHide={onHide}
            onDelete={onDelete}
            onLike={onLike}
            isMutating={isMutating}
            isNew={highlightedIds?.has(reply.id)}
          />
        ))}
    </div>
  );
}

TikTokCommentReplyThread.displayName = "TikTokCommentReplyThread";
