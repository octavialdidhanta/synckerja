import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";
import { formatCommentRelativeTime } from "@/6-0-social-media-manage-comments/lib/formatCommentRelativeTime";
import { ManageCommentsInlineReplyComposer } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsInlineReplyComposer";
import { useManageCommentsMobileLayout } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsMobileLayoutContext";
import { TikTokCommentReplyThread } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokCommentReplyThread";
import type { ManageCommentsReplyControls } from "@/6-0-social-media-manage-comments/types/manageCommentsReplyControls";
import { isOwnTikTokAccountComment } from "@/6-0-social-media-manage-comments/lib/isOwnTikTokAccountComment";
import type { TikTokCommentRow } from "@/tiktok-content/types/tiktokCommentApiTypes";

type TikTokCommentItemProps = {
  comment: TikTokCommentRow;
  organizationId: string;
  openId: string;
  videoId: string;
  replyControls: ManageCommentsReplyControls;
  onHide: (commentId: string) => void;
  onDelete: (commentId: string, parentCommentId?: string | null) => void;
  onLike?: (commentId: string) => void;
  isMutating?: boolean;
  isNew?: boolean;
  nested?: boolean;
  highlightedIds?: Set<string>;
};

function displayName(comment: TikTokCommentRow): string {
  return (
    comment.display_name?.trim() ||
    comment.user?.display_name?.trim() ||
    comment.user?.username?.trim() ||
    "User"
  );
}

function TikTokCommentItemInner({
  comment,
  organizationId,
  openId,
  videoId,
  replyControls,
  onHide,
  onDelete,
  onLike,
  isMutating,
  isNew,
  nested,
  highlightedIds,
}: TikTokCommentItemProps) {
  const { t, i18n } = useTranslation();
  const isMobileLayout = useManageCommentsMobileLayout();
  const [showReplies, setShowReplies] = useState(false);
  const name = displayName(comment);
  const initials = name.slice(0, 2).toUpperCase();
  const timeLabel = formatCommentRelativeTime(comment.create_time, i18n.language);
  const isReplyTarget = replyControls.replyToCommentId === comment.id;
  const optimisticForParent = replyControls.getOptimisticForParent(comment.id);
  const repliesExpanded =
    showReplies || isReplyTarget || optimisticForParent.length > 0;
  const canDelete = isOwnTikTokAccountComment(name, replyControls.accountLabel);

  useEffect(() => {
    if (isReplyTarget || optimisticForParent.length > 0) {
      setShowReplies(true);
    }
  }, [isReplyTarget, optimisticForParent.length]);

  return (
    <div
      className={cn(
        nested ? "py-1" : isMobileLayout ? "px-3 py-2.5" : "px-4 py-2",
        "[content-visibility:auto] [contain-intrinsic-size:auto_88px] transition-colors duration-500",
        !nested && isNew && "border-l-4 border-amber-400 bg-amber-50/90 animate-in fade-in slide-in-from-top-1",
      )}
    >
      <div className={cn(!isMobileLayout && "flex gap-2")}>
        {isMobileLayout ? null : (
          <Avatar className={cn("mt-0.5 shrink-0", nested ? "h-7 w-7" : "h-8 w-8")}>
            <AvatarImage src={comment.user?.avatar_url ?? undefined} alt={name} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "rounded-2xl px-3 py-2",
              isNew ? "bg-amber-100/80 ring-1 ring-amber-300/60" : "bg-sky-50",
            )}
          >
            <div className="mb-0.5 flex items-center gap-1.5">
              {isMobileLayout ? (
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={comment.user?.avatar_url ?? undefined} alt={name} />
                  <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                </Avatar>
              ) : null}
              <p className="text-xs font-semibold text-gray-900">{name}</p>
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
            <button
              type="button"
              className="hover:text-foreground"
              disabled={isMutating || !onLike}
              onClick={() => onLike?.(comment.id)}
            >
              {t("digitalMarketing.manageComments.like", "Like")}
              {comment.like_count > 0 ? ` · ${comment.like_count}` : ""}
            </button>
            <button
              type="button"
              className={isReplyTarget ? "font-semibold text-primary" : "hover:text-foreground"}
              disabled={isMutating}
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
            <button
              type="button"
              className="hover:text-foreground"
              disabled={isMutating}
              onClick={() => onHide(comment.id)}
              title={
                canDelete
                  ? undefined
                  : t(
                      "digitalMarketing.manageComments.hideHint",
                      "Hide another user's comment (TikTok does not allow permanent delete)",
                    )
              }
            >
              {t("digitalMarketing.manageComments.hide", "Hide")}
            </button>
            {canDelete ? (
              <button
                type="button"
                className="hover:text-destructive"
                disabled={isMutating}
                onClick={() => onDelete(comment.id, comment.parent_comment_id)}
              >
                {t("digitalMarketing.manageComments.delete", "Delete")}
              </button>
            ) : null}
            {comment.reply_count > 0 ? (
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setShowReplies((v) => !v)}
              >
                {repliesExpanded
                  ? t("digitalMarketing.manageComments.hideReplies", "Hide replies")
                  : t("digitalMarketing.manageComments.viewReplies", {
                      count: comment.reply_count,
                      defaultValue: `View ${comment.reply_count} replies`,
                    })}
              </button>
            ) : null}
          </div>

          {repliesExpanded ? (
            <TikTokCommentReplyThread
              organizationId={organizationId}
              openId={openId}
              commentId={comment.id}
              videoId={videoId}
              replyControls={replyControls}
              optimisticReplies={optimisticForParent}
              onHide={onHide}
              onDelete={onDelete}
              onLike={onLike}
              isMutating={isMutating}
              forceOpen={repliesExpanded}
              highlightedIds={highlightedIds}
            />
          ) : null}

          {isReplyTarget && !isMobileLayout ? (
            <ManageCommentsInlineReplyComposer
              accountLabel={replyControls.accountLabel}
              accountAvatarUrl={replyControls.accountAvatarUrl}
              mentionLabel={name}
              disabled={isMutating}
              isSubmitting={replyControls.isSubmittingReply}
              onCancel={replyControls.onCancelReply}
              onSubmit={(text) => replyControls.onSubmitReply(comment.id, text, name)}
            />
          ) : null}
        </div>
      </div>
      {isReplyTarget && isMobileLayout ? (
        <ManageCommentsInlineReplyComposer
          accountLabel={replyControls.accountLabel}
          accountAvatarUrl={replyControls.accountAvatarUrl}
          mentionLabel={name}
          disabled={isMutating}
          isSubmitting={replyControls.isSubmittingReply}
          onCancel={replyControls.onCancelReply}
          onSubmit={(text) => replyControls.onSubmitReply(comment.id, text, name)}
        />
      ) : null}
    </div>
  );
}

export const TikTokCommentItem = memo(TikTokCommentItemInner);
TikTokCommentItem.displayName = "TikTokCommentItem";
