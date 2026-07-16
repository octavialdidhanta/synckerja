import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MetaCommentItem } from '@/6-0-social-media-manage-comments/components/meta/MetaCommentItem';
import { MetaAutoReplyBubble } from '@/6-0-social-media-manage-comments/components/meta/MetaAutoReplyBubble';
import type { ManageCommentsReplyControls } from '@/6-0-social-media-manage-comments/types/manageCommentsReplyControls';
import type { LeadMagnetAutoCommentReply } from '@/6-0-social-media-manage-comments/hooks/useLeadMagnetAutoCommentReplies';
import type { MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';
import { useMetaContentCommentRepliesQuery } from '@/meta-content/hooks/useMetaContentComments';

type MetaCommentReplyThreadProps = {
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
  mediaId: string;
  commentId: string;
  replyControls: ManageCommentsReplyControls;
  autoReply?: LeadMagnetAutoCommentReply | null;
  isMutating?: boolean;
  forceOpen?: boolean;
};

function normalizeReplyText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function MetaCommentReplyThread({
  organizationId,
  platform,
  accountId,
  mediaId,
  commentId,
  replyControls,
  autoReply = null,
  isMutating,
  forceOpen,
}: MetaCommentReplyThreadProps) {
  const { t, i18n } = useTranslation();
  const shouldFetch = forceOpen || replyControls.replyToCommentId === commentId || Boolean(autoReply);

  const repliesQuery = useMetaContentCommentRepliesQuery({
    organizationId,
    platform,
    accountId,
    mediaId,
    commentId,
    enabled: Boolean(organizationId && accountId && mediaId && commentId && shouldFetch),
  });

  const serverReplies = useMemo(() => {
    const rows = repliesQuery.data?.comments ?? [];
    return [...rows].sort((a, b) => {
      const ta = a.published_at ? Date.parse(a.published_at) : 0;
      const tb = b.published_at ? Date.parse(b.published_at) : 0;
      return tb - ta;
    });
  }, [repliesQuery.data?.comments]);

  const showSyntheticAutoReply = useMemo(() => {
    if (!autoReply) return false;
    if (autoReply.replyId && serverReplies.some((r) => r.id === autoReply.replyId)) {
      return false;
    }
    const autoText = normalizeReplyText(autoReply.text);
    return !serverReplies.some((r) => normalizeReplyText(r.text) === autoText);
  }, [autoReply, serverReplies]);

  if (!shouldFetch) return null;

  if (repliesQuery.isLoading && serverReplies.length === 0 && !showSyntheticAutoReply) {
    return (
      <div className="mt-2 flex items-center gap-2 border-l-2 border-sky-200 pl-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('digitalMarketing.manageComments.loadingReplies', 'Loading replies…')}
      </div>
    );
  }

  if (serverReplies.length === 0 && !showSyntheticAutoReply) return null;

  return (
    <div className="mt-2 space-y-1 border-l-2 border-sky-300 pl-3">
      {showSyntheticAutoReply && autoReply ? (
        <MetaAutoReplyBubble
          reply={autoReply}
          accountLabel={replyControls.accountLabel}
          accountAvatarUrl={replyControls.accountAvatarUrl}
          language={i18n.language}
        />
      ) : null}
      {serverReplies.map((reply) => (
        <MetaCommentItem
          key={reply.id}
          comment={reply}
          organizationId={organizationId}
          platform={platform}
          accountId={accountId}
          mediaId={mediaId}
          nested
          replyControls={replyControls}
          isMutating={isMutating}
        />
      ))}
    </div>
  );
}
