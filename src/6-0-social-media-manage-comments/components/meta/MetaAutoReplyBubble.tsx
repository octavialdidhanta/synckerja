import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { formatCommentRelativeTimeFromIso } from '@/6-0-social-media-manage-comments/lib/formatCommentRelativeTime';
import type { LeadMagnetAutoCommentReply } from '@/6-0-social-media-manage-comments/hooks/useLeadMagnetAutoCommentReplies';

type MetaAutoReplyBubbleProps = {
  reply: LeadMagnetAutoCommentReply;
  accountLabel: string;
  accountAvatarUrl?: string | null;
  language: string;
};

export function MetaAutoReplyBubble({
  reply,
  accountLabel,
  accountAvatarUrl,
  language,
}: MetaAutoReplyBubbleProps) {
  const { t } = useTranslation();
  const initials = accountLabel.slice(0, 2).toUpperCase();
  const timeLabel = formatCommentRelativeTimeFromIso(reply.sentAt, language);

  return (
    <div className="py-1">
      <div className="flex gap-2">
        <Avatar className="mt-0.5 h-7 w-7 shrink-0">
          <AvatarImage src={accountAvatarUrl ?? undefined} alt={accountLabel} />
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200/80">
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-gray-900">{accountLabel}</p>
              <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {t('digitalMarketing.manageComments.autoReplyBadge', 'Auto')}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{reply.text}</p>
          </div>
          {timeLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">{timeLabel}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
