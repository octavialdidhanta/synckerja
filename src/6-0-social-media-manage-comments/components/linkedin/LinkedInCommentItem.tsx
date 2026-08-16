import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { cn } from '@/shared/lib/utils';
import { formatCommentRelativeTimeFromIso } from '@/6-0-social-media-manage-comments/lib/formatCommentRelativeTime';
import { ManageCommentsInlineReplyComposer } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsInlineReplyComposer';
import { useManageCommentsMobileLayout } from '@/6-0-social-media-manage-comments/components/shared/ManageCommentsMobileLayoutContext';
import { LinkedInCommentReplyThread } from '@/6-0-social-media-manage-comments/components/linkedin/LinkedInCommentReplyThread';
import type { ManageCommentsReplyControls } from '@/6-0-social-media-manage-comments/types/manageCommentsReplyControls';
import type { LinkedInContentCommentRow } from '@/linkedin-content/hooks/useLinkedInContentComments';

type LinkedInCommentItemProps = {
  comment: LinkedInContentCommentRow;
  organizationId: string;
  pageId: string;
  postId: string;
  replyControls: ManageCommentsReplyControls;
  isMutating?: boolean;
  nested?: boolean;
};

export function LinkedInCommentItem({
  comment,
  organizationId,
  pageId,
  postId,
  replyControls,
  isMutating,
  nested,
}: LinkedInCommentItemProps) {
  const { t, i18n } = useTranslation();
  const isMobileLayout = useManageCommentsMobileLayout();
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
    <div className={cn(nested ? 'py-1' : isMobileLayout ? 'px-3 py-2.5' : 'px-4 py-2')}>
      <div className={cn(!isMobileLayout && 'flex gap-2')}>
        {isMobileLayout ? null : (
          <Avatar className={cn('mt-0.5 shrink-0', nested ? 'h-7 w-7' : 'h-8 w-8')}>
            <AvatarImage src={comment.author_avatar_url ?? undefined} alt={name} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-sky-50 px-3 py-2">
            <div className="mb-0.5 flex items-center gap-1.5">
              {isMobileLayout ? (
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={comment.author_avatar_url ?? undefined} alt={name} />
                  <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                </Avatar>
              ) : null}
              <p className="text-xs font-semibold text-gray-900">{name}</p>
            </div>
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
                className="font-medium hover:text-foreground"
                onClick={() => replyControls.onReply(comment.id)}
              >
                {t('digitalMarketing.manageComments.reply', 'Reply')}
              </button>
            ) : null}
            {comment.reply_count > 0 ? (
              <button
                type="button"
                className="font-medium hover:text-foreground"
                onClick={() => setShowReplies((v) => !v)}
              >
                {repliesExpanded
                  ? t('digitalMarketing.manageComments.hideReplies', 'Hide replies')
                  : t('digitalMarketing.manageComments.viewReplies', 'View replies')}
                {` (${comment.reply_count})`}
              </button>
            ) : null}
          </div>
          {isReplyTarget && !isMobileLayout ? (
            <ManageCommentsInlineReplyComposer
              className="mt-2"
              accountLabel={replyControls.accountLabel}
              accountAvatarUrl={replyControls.accountAvatarUrl}
              onCancel={replyControls.onCancelReply}
              onSubmit={(text) => replyControls.onSubmitReply(comment.id, text)}
              isSubmitting={replyControls.isSubmittingReply}
            />
          ) : null}
          {repliesExpanded ? (
            <LinkedInCommentReplyThread
              organizationId={organizationId}
              pageId={pageId}
              postId={postId}
              commentId={comment.id}
              replyControls={replyControls}
              isMutating={isMutating}
              forceOpen={showReplies}
            />
          ) : null}
        </div>
      </div>
      {isReplyTarget && isMobileLayout ? (
        <ManageCommentsInlineReplyComposer
          className="mt-2"
          accountLabel={replyControls.accountLabel}
          accountAvatarUrl={replyControls.accountAvatarUrl}
          onCancel={replyControls.onCancelReply}
          onSubmit={(text) => replyControls.onSubmitReply(comment.id, text)}
          isSubmitting={replyControls.isSubmittingReply}
        />
      ) : null}
    </div>
  );
}
