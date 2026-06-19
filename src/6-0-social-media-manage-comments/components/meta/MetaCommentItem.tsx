import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { cn } from '@/shared/lib/utils';
import { formatCommentRelativeTimeFromIso } from '@/6-0-social-media-manage-comments/lib/formatCommentRelativeTime';
import { ManageCommentsInlineReplyComposer } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsInlineReplyComposer';
import { MetaCommentReplyThread } from '@/6-0-social-media-manage-comments/components/meta/MetaCommentReplyThread';
import type { ManageCommentsReplyControls } from '@/6-0-social-media-manage-comments/types/manageCommentsReplyControls';
import type { MetaContentCommentRow, MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';

type MetaCommentItemProps = {
  comment: MetaContentCommentRow;
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
  mediaId: string;
  replyControls: ManageCommentsReplyControls;
  isMutating?: boolean;
  nested?: boolean;
};

export function MetaCommentItem({
  comment,
  organizationId,
  platform,
  accountId,
  mediaId,
  replyControls,
  isMutating,
  nested,
}: MetaCommentItemProps) {
  const { t, i18n } = useTranslation();
  const [showReplies, setShowReplies] = useState(false);
  const name = comment.author_display_name?.trim() || t('digitalMarketing.manageComments.unknownUser', 'User');
  const initials = name.slice(0, 2).toUpperCase();
  const timeLabel = formatCommentRelativeTimeFromIso(comment.published_at, i18n.language);
  const isReplyTarget = replyControls.replyToCommentId === comment.id;
  const repliesExpanded = showReplies || isReplyTarget;

  useEffect(() => {
    if (isReplyTarget) setShowReplies(true);
  }, [isReplyTarget]);

  return (
    <div className={cn(nested ? 'py-1' : 'px-4 py-2')}>
      <div className="flex gap-2">
        <Avatar className={cn('mt-0.5 shrink-0', nested ? 'h-7 w-7' : 'h-8 w-8')}>
          <AvatarImage src={comment.author_avatar_url ?? undefined} alt={name} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-sky-50 px-3 py-2">
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
            {comment.reply_count > 0 ? (
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setShowReplies((v) => !v)}
              >
                {repliesExpanded
                  ? t('digitalMarketing.manageComments.hideReplies', 'Hide replies')
                  : t('digitalMarketing.manageComments.viewReplies', {
                      count: comment.reply_count,
                      defaultValue: `View ${comment.reply_count} replies`,
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
