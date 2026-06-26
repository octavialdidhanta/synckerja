import { useEffect, useState, useCallback } from "react";

import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";

import { cn } from "@/shared/lib/utils";

import { formatCommentRelativeTime } from "@/6-0-social-media-manage-comments/lib/formatCommentRelativeTime";

import { ManageCommentsInlineReplyComposer } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsInlineReplyComposer";

import { YouTubeCommentReplyThread } from "@/6-0-social-media-manage-comments/components/youtube/YouTubeCommentReplyThread";

import type { ManageCommentsReplyControls } from "@/6-0-social-media-manage-comments/types/manageCommentsReplyControls";

import type { YouTubeCommentRow } from "@/youtube-content/types/youtubeCommentApiTypes";



type YouTubeCommentItemProps = {

  comment: YouTubeCommentRow;

  organizationId: string;

  channelId: string;

  videoId: string;

  replyControls: ManageCommentsReplyControls;

  isMutating?: boolean;

  isNew?: boolean;

  nested?: boolean;

  rootThreadId?: string | null;

  forceRepliesExpanded?: boolean;

  highlightedIds?: Set<string>;

};



export function YouTubeCommentItem({

  comment,

  organizationId,

  channelId,

  videoId,

  replyControls,

  isMutating,

  isNew,

  nested,

  rootThreadId,

  forceRepliesExpanded,

  highlightedIds,

}: YouTubeCommentItemProps) {

  const { t, i18n } = useTranslation();

  const [showReplies, setShowReplies] = useState(() => comment.reply_count > 0);
  const [knownReplyCount, setKnownReplyCount] = useState(0);

  const name = comment.display_name?.trim() || "User";

  const initials = name.slice(0, 2).toUpperCase();

  const timeLabel = formatCommentRelativeTime(comment.create_time, i18n.language);

  const isReplyTarget = replyControls.replyToCommentId === comment.id;

  const optimisticForParent = replyControls.getOptimisticForParent(comment.id);

  const replyCountVisible = Math.max(
    comment.reply_count,
    optimisticForParent.length,
    knownReplyCount,
  );

  const hasReplies = replyCountVisible > 0;

  const repliesExpanded =
    !nested
    && (showReplies || isReplyTarget || optimisticForParent.length > 0 || forceRepliesExpanded || comment.reply_count > 0);

  const canReply = comment.can_reply !== false;

  const handleRepliesLoaded = useCallback((count: number) => {
    setKnownReplyCount((prev) => Math.max(prev, count));
    if (count > 0) {
      setShowReplies(true);
    }
  }, []);

  useEffect(() => {
    setKnownReplyCount(0);
    setShowReplies(comment.reply_count > 0);
  }, [comment.id, comment.reply_count]);

  useEffect(() => {
    if (isReplyTarget || optimisticForParent.length > 0 || comment.reply_count > 0) {
      setShowReplies(true);
    }
  }, [isReplyTarget, optimisticForParent.length, comment.reply_count]);



  return (

    <div

      className={cn(

        nested ? "py-1" : "px-4 py-2",

        "transition-colors duration-500",

        !nested && isNew && "border-l-4 border-amber-400 bg-amber-50/90 animate-in fade-in slide-in-from-top-1",

      )}

    >

      <div className="flex gap-2">

        <Avatar className={cn("mt-0.5 shrink-0", nested ? "h-7 w-7" : "h-8 w-8")}>

          <AvatarImage src={comment.avatar_url ?? undefined} alt={name} />

          <AvatarFallback className="text-xs">{initials}</AvatarFallback>

        </Avatar>

        <div className="min-w-0 flex-1">

          <div

            className={cn(

              "rounded-2xl px-3 py-2",

              isNew ? "bg-amber-100/80 ring-1 ring-amber-300/60" : "bg-sky-50",

              comment.is_channel_owner && "ring-1 ring-primary/20",

            )}

          >

            <div className="mb-0.5 flex items-center gap-2">

              <p className="text-xs font-semibold text-gray-900">{name}</p>

              {comment.is_channel_owner ? (

                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">

                  {t("digitalMarketing.manageComments.youtubeChannelOwner", "Channel")}

                </span>

              ) : null}

              {isNew ? (

                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">

                  {t("digitalMarketing.manageComments.newBadge", "New")}

                </span>

              ) : null}

            </div>

            <p className="whitespace-pre-wrap text-sm text-gray-800">{comment.text}</p>

          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">

            {timeLabel ? <span>{timeLabel}</span> : null}

            {!nested && hasReplies ? (
              <span className="font-medium text-foreground">
                {t("digitalMarketing.manageComments.replyCount", {
                  count: replyCountVisible,
                })}
              </span>
            ) : null}

            {comment.like_count > 0 ? (

              <span>

                {t("digitalMarketing.manageComments.youtubeLikeCount", "{{count}} likes", {

                  count: comment.like_count,

                })}

              </span>

            ) : null}

            <button

              type="button"

              className={isReplyTarget ? "font-semibold text-primary" : "hover:text-foreground"}

              disabled={isMutating || !canReply}

              title={
                canReply
                  ? undefined
                  : t(
                      "digitalMarketing.manageComments.youtubeReplyBlocked",
                      "YouTube does not allow replies on this thread.",
                    )
              }

              onClick={() => {

                if (isReplyTarget) {

                  replyControls.onCancelReply();

                } else {

                  replyControls.onReply(comment.id, name);

                }

              }}

            >

              {t("digitalMarketing.manageComments.reply", "Reply")}

            </button>

            {!nested && hasReplies ? (
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setShowReplies((prev) => !prev)}
              >
                {repliesExpanded
                  ? t("digitalMarketing.manageComments.hideReplies", "Hide replies")
                  : t("digitalMarketing.manageComments.showReplies", "Show replies")}
              </button>
            ) : null}

          </div>

          {!nested && repliesExpanded ? (

            <YouTubeCommentReplyThread

              organizationId={organizationId}

              channelId={channelId}

              commentId={comment.id}

              videoId={videoId}

              threadId={comment.thread_id ?? rootThreadId}

              replyControls={replyControls}

              optimisticReplies={optimisticForParent}

              isMutating={isMutating}

              highlightedIds={highlightedIds}

              onRepliesLoaded={handleRepliesLoaded}

            />

          ) : null}

          {isReplyTarget ? (

            <ManageCommentsInlineReplyComposer

              accountLabel={replyControls.accountLabel}

              accountAvatarUrl={replyControls.accountAvatarUrl}

              mentionLabel={name}

              disabled={isMutating}

              isSubmitting={replyControls.isSubmittingReply}

              onCancel={replyControls.onCancelReply}

              onSubmit={(text) =>
                replyControls.onSubmitReply(comment.id, text, name, {
                  threadId: comment.thread_id ?? rootThreadId,
                  targetParentCommentId: comment.parent_comment_id ?? comment.id,
                })
              }

            />

          ) : null}

        </div>

      </div>

    </div>

  );

}



YouTubeCommentItem.displayName = "YouTubeCommentItem";

