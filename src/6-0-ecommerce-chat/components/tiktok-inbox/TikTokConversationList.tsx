import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/components/ui/badge';
import {
  formatTikTokConversationTime,
  formatTikTokLatestMessagePreview,
} from './TikTokConversationPreview';
import {
  getBuyerParticipant,
  type TikTokConversation,
} from './tiktokConversation.types';

type Props = {
  conversations: TikTokConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function TikTokConversationList({ conversations, selectedId, onSelect }: Props) {
  const { t } = useTranslation();

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">
          {t('operations.ecommerceChat.tiktok.emptyListTitle')}
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {t('operations.ecommerceChat.tiktok.emptyListBody')}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {conversations.map((c) => {
        const buyer = getBuyerParticipant(c);
        const nickname =
          buyer?.nickname?.trim() ||
          t('operations.ecommerceChat.tiktok.unknownBuyer');
        const avatar = buyer?.avatar?.trim() || '';
        const unread = Number(c.unread_count ?? 0);
        const preview = formatTikTokLatestMessagePreview(c.latest_message, t);
        const time = formatTikTokConversationTime(
          c.latest_message?.create_time ?? c.create_time,
        );
        const selected = c.id === selectedId;
        const platform = buyer?.buyer_platform?.trim();

        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                'flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
                selected && 'bg-primary/5',
              )}
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                    {nickname.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{nickname}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{preview}</p>
                  {unread > 0 && (
                    <Badge className="h-5 min-w-5 shrink-0 justify-center px-1.5 text-[10px]">
                      {unread > 99 ? '99+' : unread}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {platform && (
                    <Badge variant="outline" className="text-[9px] font-normal">
                      {platform === 'TOKOPEDIA'
                        ? t('operations.ecommerceChat.tiktok.platform.tokopedia')
                        : t('operations.ecommerceChat.tiktok.platform.tiktokShop')}
                    </Badge>
                  )}
                  {c.can_send_message === false && (
                    <span className="text-[10px] text-muted-foreground">
                      {t('operations.ecommerceChat.tiktok.cannotSendHint')}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
