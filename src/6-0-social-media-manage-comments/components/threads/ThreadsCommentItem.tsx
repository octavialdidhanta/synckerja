import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { cn } from '@/shared/lib/utils';
import { formatCommentRelativeTimeFromIso } from '@/6-0-social-media-manage-comments/lib/formatCommentRelativeTime';
import { ManageCommentsInlineReplyComposer } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsInlineReplyComposer';
import { useManageCommentsMobileLayout } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsMobileLayoutContext';
import { ManageCommentsInlineEditComposer } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsInlineEditComposer';
import { TikTokOptimisticReplyBubble } from '@/6-0-social-media-manage-comments/components/tiktok/TikTokOptimisticReplyBubble';
import { ThreadsCommentReplyThread } from '@/6-0-social-media-manage-comments/components/threads/ThreadsCommentReplyThread';
import type { ManageCommentsReplyControls } from '@/6-0-social-media-manage-comments/types/manageCommentsReplyControls';
import type { ThreadsContentCommentRow } from '@/threads-content/hooks/useThreadsContentComments';

type ThreadsCommentItemProps = {
  comment: ThreadsContentCommentRow;
  organizationId: string;
  accountId: string;
  mediaId: string;
  replyControls: ManageCommentsReplyControls;
  isMutating?: boolean;
  isNew?: boolean;
  nested?: boolean;
  replyDisabled?: boolean;
  highlightedIds?: Set<string>;
  localReplies?: ThreadsContentCommentRow[];
  forceRepliesExpanded?: boolean;
  onServerRepliesLoaded?: (parentCommentId: string, serverComments: ThreadsContentCommentRow[]) => void;
  onHide?: (commentId: string) => void;
  onDelete?: (commentId: string, parentCommentId?: string | null) => void;
  onEdit?: (
    commentId: string,
    parentCommentId: string,
    text: string,
    meta?: { publishedAt?: string | null; isChannelOwner?: boolean },
  ) => Promise<void>;
  isSubmittingEdit?: boolean;
};

const THREADS_EDIT_WINDOW_MS = 15 * 60 * 1000;

function canEditThreadsCommentRow(comment: ThreadsContentCommentRow): boolean {
  if (comment.can_edit) return true;
  if (!comment.is_channel_owner || !comment.published_at) return false;
  const ms = Date.parse(comment.published_at);
  return Number.isFinite(ms) && Date.now() - ms <= THREADS_EDIT_WINDOW_MS;
}

export function ThreadsCommentItem({
  comment,
  organizationId,
  accountId,
  mediaId,
  replyControls,
  isMutating,
  isNew,
  nested,
  replyDisabled = false,
  highlightedIds,
  localReplies = [],
  forceRepliesExpanded = false,
  onServerRepliesLoaded,
  onHide,
  onDelete,
  onEdit,
  isSubmittingEdit,
}: ThreadsCommentItemProps) {
  const { t, i18n } = useTranslation();
  const isMobileLayout = useManageCommentsMobileLayout();
  const [showReplies, setShowReplies] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const name = comment.author_display_name?.trim() || t('digitalMarketing.manageComments.unknownUser', 'User');
  const initials = name.slice(0, 2).toUpperCase();
  const timeLabel = formatCommentRelativeTimeFromIso(comment.published_at, i18n.language);
  const isReplyTarget = replyControls.replyToCommentId === comment.id;
  const optimisticForParent = replyControls.getOptimisticForParent(comment.id);
  const replyCountVisible = Math.max(
    comment.reply_count,
    optimisticForParent.length,
    localReplies.length,
  );
  const hasPendingReplies = optimisticForParent.length > 0 || localReplies.length > 0;
  const repliesExpanded =
    showReplies ||
    isReplyTarget ||
    hasPendingReplies ||
    forceRepliesExpanded;
  const canEdit = canEditThreadsCommentRow(comment);
  const canDelete = comment.is_channel_owner;
  const editParentId = comment.parent_comment_id ?? mediaId;

  const serverHiddenTexts = nested
    ? undefined
    : new Set(
        [...localReplies, ...optimisticForParent.map((r) => ({ text: r.text }))].map((r) =>
          r.text.trim(),
        ),
      );

  useEffect(() => {
    if (isReplyTarget || forceRepliesExpanded || hasPendingReplies) {
      setShowReplies(true);
    }
  }, [isReplyTarget, forceRepliesExpanded, hasPendingReplies]);

  useEffect(() => {
    if (comment.reply_count > 0) {
      setShowReplies(true);
    }
  }, [comment.reply_count]);

  return (
    <div
      className={cn(
        nested ? 'py-1' : isMobileLayout ? 'px-3 py-2.5' : 'px-4 py-2',
        'transition-colors duration-500',
        !nested && isNew && 'border-l-4 border-amber-400 bg-amber-50/90 animate-in fade-in slide-in-from-top-1',
      )}
    >
      <div className={cn(!isMobileLayout && 'flex gap-2')}>
        {isMobileLayout ? null : (
          <Avatar className={cn('mt-0.5 shrink-0', nested ? 'h-7 w-7' : 'h-8 w-8')}>
            <AvatarImage src={comment.author_avatar_url ?? undefined} alt={name} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'rounded-2xl px-3 py-2',
              isNew ? 'bg-amber-100/80 ring-1 ring-amber-300/60' : 'bg-sky-50',
            )}
          >
            <div className="mb-0.5 flex items-center gap-1.5">
              {isMobileLayout ? (
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={comment.author_avatar_url ?? undefined} alt={name} />
                  <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                </Avatar>
              ) : null}
              <p className="text-xs font-semibold text-gray-900">{name}</p>
              {isNew ? (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {t('digitalMarketing.manageComments.newBadge', 'New')}
                </span>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-sm text-gray-800">
              {isEditing ? null : comment.text}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {timeLabel ? <span>{timeLabel}</span> : null}
            {comment.can_reply && !replyDisabled ? (
              <button
                type="button"
                className={cn('font-medium hover:text-foreground', isReplyTarget && 'font-semibold text-primary')}
                disabled={isMutating}
                onClick={() => {
                  if (isReplyTarget) {
                    replyControls.onCancelReply();
                  } else {
                    replyControls.onReply(comment.id);
                  }
                }}
              >
                {t('digitalMarketing.manageComments.reply', 'Reply')}
              </button>
            ) : null}
            {onHide ? (
              <button
                type="button"
                className="hover:text-foreground"
                disabled={isMutating}
                onClick={() => onHide(comment.id)}
                title={t(
                  'digitalMarketing.manageComments.threadsHideHint',
                  'Hide this reply on Threads',
                )}
              >
                {t('digitalMarketing.manageComments.hide', 'Hide')}
              </button>
            ) : null}
            {canDelete && onDelete ? (
              <button
                type="button"
                className="hover:text-destructive"
                disabled={isMutating}
                onClick={() => onDelete(comment.id, comment.parent_comment_id)}
              >
                {t('digitalMarketing.manageComments.delete', 'Delete')}
              </button>
            ) : null}
            {canEdit && onEdit ? (
              <button
                type="button"
                className="hover:text-foreground"
                disabled={isMutating || isEditing}
                onClick={() => setIsEditing(true)}
              >
                {t('digitalMarketing.manageComments.edit', 'Edit')}
              </button>
            ) : null}
            {replyCountVisible > 0 ? (
              <button
                type="button"
                className="font-medium hover:text-foreground"
                onClick={() => setShowReplies((v) => !v)}
              >
                {repliesExpanded
                  ? t('digitalMarketing.manageComments.hideReplies', 'Hide replies')
                  : t('digitalMarketing.manageComments.viewReplies', {
                      count: replyCountVisible,
                      defaultValue: `View ${replyCountVisible} replies`,
                    })}
              </button>
            ) : null}
          </div>
          {isEditing && onEdit ? (
            <ManageCommentsInlineEditComposer
              initialText={comment.text}
              disabled={isMutating}
              isSubmitting={isSubmittingEdit}
              onCancel={() => setIsEditing(false)}
              onSubmit={async (text) => {
                await onEdit(comment.id, editParentId, text, {
                  publishedAt: comment.published_at,
                  isChannelOwner: comment.is_channel_owner,
                });
                setIsEditing(false);
              }}
            />
          ) : null}
          {isReplyTarget && !isMobileLayout ? (
            <ManageCommentsInlineReplyComposer
              accountLabel={replyControls.accountLabel}
              accountAvatarUrl={replyControls.accountAvatarUrl}
              onCancel={replyControls.onCancelReply}
              onSubmit={(text) => replyControls.onSubmitReply(comment.id, text, name)}
              isSubmitting={replyControls.isSubmittingReply}
            />
          ) : null}
          {hasPendingReplies ? (
            <div className="mt-2 space-y-1 border-l-2 border-sky-300 pl-3">
              {optimisticForParent.map((reply) => (
                <TikTokOptimisticReplyBubble key={reply.tempId} reply={reply} nested />
              ))}
              {!nested
                ? localReplies.map((reply) => (
                    <ThreadsCommentItem
                      key={reply.id}
                      comment={reply}
                      organizationId={organizationId}
                      accountId={accountId}
                      mediaId={mediaId}
                      nested
                      replyControls={replyControls}
                      isMutating={isMutating}
                      onHide={onHide}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      isSubmittingEdit={isSubmittingEdit}
                      onServerRepliesLoaded={onServerRepliesLoaded}
                    />
                  ))
                : null}
            </div>
          ) : null}
          {repliesExpanded ? (
            <ThreadsCommentReplyThread
              organizationId={organizationId}
              accountId={accountId}
              mediaId={mediaId}
              commentId={comment.id}
              replyControls={replyControls}
              isMutating={isMutating}
              forceOpen={showReplies || forceRepliesExpanded || comment.reply_count > 0}
              hiddenTexts={serverHiddenTexts}
              replyDisabled={replyDisabled}
              highlightedIds={highlightedIds}
              onHide={onHide}
              onDelete={onDelete}
              onEdit={onEdit}
              isSubmittingEdit={isSubmittingEdit}
              onServerRepliesLoaded={onServerRepliesLoaded}
            />
          ) : null}
        </div>
      </div>
      {isReplyTarget && isMobileLayout ? (
        <ManageCommentsInlineReplyComposer
          accountLabel={replyControls.accountLabel}
          accountAvatarUrl={replyControls.accountAvatarUrl}
          onCancel={replyControls.onCancelReply}
          onSubmit={(text) => replyControls.onSubmitReply(comment.id, text, name)}
          isSubmitting={replyControls.isSubmittingReply}
        />
      ) : null}
    </div>
  );
}
