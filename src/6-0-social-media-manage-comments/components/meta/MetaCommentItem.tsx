import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { cn } from '@/shared/lib/utils';
import { formatCommentRelativeTimeFromIso } from '@/6-0-social-media-manage-comments/lib/formatCommentRelativeTime';
import { ManageCommentsInlineReplyComposer } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsInlineReplyComposer';
import { MetaCommentReplyThread } from '@/6-0-social-media-manage-comments/components/meta/MetaCommentReplyThread';
import type { LeadMagnetAutoCommentReply } from '@/6-0-social-media-manage-comments/hooks/useLeadMagnetAutoCommentReplies';
import type { ManageCommentsReplyControls } from '@/6-0-social-media-manage-comments/types/manageCommentsReplyControls';
import type { MetaContentCommentRow, MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';

type MetaCommentItemProps = {
  comment: MetaContentCommentRow;
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
  mediaId: string;
  replyControls: ManageCommentsReplyControls;
  autoReply?: LeadMagnetAutoCommentReply | null;
  isMutating?: boolean;
  isNew?: boolean;
  nested?: boolean;
};

export function MetaCommentItem({
  comment,
  organizationId,
  platform,
  accountId,
  mediaId,
  replyControls,
  autoReply = null,
  isMutating,
  isNew,
  nested,
}: MetaCommentItemProps) {
  const { t, i18n } = useTranslation();
  const [showReplies, setShowReplies] = useState(false);
  const name = comment.author_display_name?.trim() || t('digitalMarketing.manageComments.unknownUser', 'User');
  const initials = name.slice(0, 2).toUpperCase();
  const timeLabel = formatCommentRelativeTimeFromIso(comment.published_at, i18n.language);
  const isReplyTarget = replyControls.replyToCommentId === comment.id;
  const hasAutoReply = Boolean(autoReply);
  const repliesExpanded = showReplies || isReplyTarget || comment.reply_count > 0 || hasAutoReply;

  useEffect(() => {
    if (isReplyTarget || comment.reply_count > 0 || hasAutoReply) {
      setShowReplies(true);
    }
  }, [isReplyTarget, comment.reply_count, hasAutoReply]);

  return (
    <div
      className={cn(
        nested ? 'py-1' : 'px-4 py-2',
        !nested && isNew && 'border-l-4 border-amber-400 bg-amber-50/90 animate-in fade-in slide-in-from-top-1',
      )}
    >
      <div className="flex gap-2">
        <Avatar className={cn('mt-0.5 shrink-0', nested ? 'h-7 w-7' : 'h-8 w-8')}>
          <AvatarImage src={comment.author_avatar_url ?? undefined} alt={name} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'rounded-2xl px-3 py-2',
              isNew ? 'bg-amber-100/80 ring-1 ring-amber-300/60' : 'bg-sky-50',
            )}
          >
            <p className="mb-0.5 text-xs font-semibold text-gray-900">{name}</p>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{comment.text}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {timeLabel ? <span>{timeLabel}</span> : null}
            <button type="button" className="hover:text-foreground" disabled tabIndex={-1}>
              {t('digitalMarketing.manageComments.like', 'Like')}
              {comment.like_count > 0 ? ` · ${comment.like_count}` : ''}
            </button>
            {comment.can_reply ? (
              <button
                type="button"
                className={isReplyTarget ? 'font-semibold text-primary' : 'hover:text-foreground'}
                disabled={isMutating}
                onClick={() => {
                  if (isReplyTarget) {
                    replyControls.onCancelReply();
                  } else {
                    replyControls.onReply(comment.id, name);
                  }
                }}
              >
                {t('digitalMarketing.manageComments.reply', 'Reply')}
              </button>
            ) : null}
            {comment.reply_count > 0 || hasAutoReply ? (
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setShowReplies((v) => !v)}
              >
                {repliesExpanded
                  ? t('digitalMarketing.manageComments.hideReplies', 'Hide replies')
                  : t('digitalMarketing.manageComments.viewReplies', {
                      count: Math.max(comment.reply_count, hasAutoReply ? 1 : 0),
                      defaultValue: `View ${Math.max(comment.reply_count, hasAutoReply ? 1 : 0)} replies`,
                    })}
              </button>
            ) : null}
          </div>

          {repliesExpanded ? (
            <MetaCommentReplyThread
              organizationId={organizationId}
              platform={platform}
              accountId={accountId}
              mediaId={mediaId}
              commentId={comment.id}
              replyControls={replyControls}
              autoReply={autoReply}
              isMutating={isMutating}
              forceOpen={repliesExpanded}
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
              onSubmit={(text) => replyControls.onSubmitReply(comment.id, text, name)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
