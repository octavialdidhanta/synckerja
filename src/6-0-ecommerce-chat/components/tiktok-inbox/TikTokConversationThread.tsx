import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { useTikTokShopConversationMessages } from '../../hooks/useTikTokShopConversationMessages';
import { useTikTokShopReadMessages } from '../../hooks/useTikTokShopReadMessages';
import { TikTokMessageBubble } from './TikTokMessageBubble';
import { TikTokMessageComposer } from './TikTokMessageComposer';
import {
  flattenMessagesAscending,
} from './TikTokConversationPreview';
import {
  getBuyerParticipant,
  type TikTokConversation,
} from './tiktokConversation.types';

type Props = {
  organizationId: string;
  accountId: string;
  conversation: TikTokConversation;
};

function mapThreadError(code: string | undefined, fallback: string, t: (k: string) => string) {
  switch (code) {
    case 'RATE_LIMIT':
      return t('operations.ecommerceChat.tiktok.errors.rateLimit');
    case 'TTS_DAILY_QUOTA':
      return t('operations.ecommerceChat.tiktok.errors.dailyQuota');
    case 'TTS_NOT_FOUND':
      return t('operations.ecommerceChat.tiktok.errors.notFound');
    case 'TTS_INTERNAL':
      return t('operations.ecommerceChat.tiktok.errors.internal');
    case 'NOT_CONNECTED':
    case 'TOKEN_ERROR':
      return t('operations.ecommerceChat.tiktok.errors.notConnected');
    default:
      return fallback || t('operations.ecommerceChat.tiktok.errors.generic');
  }
}

export function TikTokConversationThread({
  organizationId,
  accountId,
  conversation,
}: Props) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const lastReadKeyRef = useRef<string | null>(null);
  const buyer = getBuyerParticipant(conversation);
  const title =
    buyer?.nickname?.trim() || t('operations.ecommerceChat.tiktok.unknownBuyer');

  const query = useTikTokShopConversationMessages(
    organizationId,
    accountId,
    conversation.id,
  );
  const readMessages = useTikTokShopReadMessages();

  const messages = useMemo(
    () => flattenMessagesAscending(query.data?.pages ?? []),
    [query.data?.pages],
  );

  const unsupportedTip =
    query.data?.pages?.[0]?.unsupported_msg_tips?.trim() ||
    t('operations.ecommerceChat.tiktok.thread.unsupportedFallback');

  // Mark conversation as read when opened (skip if already unread_count === 0)
  useEffect(() => {
    const unread = Number(conversation.unread_count ?? 0);
    if (unread <= 0) return;

    const key = `${accountId}:${conversation.id}`;
    if (lastReadKeyRef.current === key) return;
    lastReadKeyRef.current = key;

    readMessages.mutate(
      {
        organizationId,
        accountId,
        conversationId: conversation.id,
      },
      {
        onError: () => {
          if (lastReadKeyRef.current === key) {
            lastReadKeyRef.current = null;
          }
          toast.error(t('operations.ecommerceChat.tiktok.read.errors.generic'));
        },
      },
    );
    // Intentionally omit `readMessages` / `t` to avoid re-fire on mutation identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, accountId, conversation.id, conversation.unread_count]);

  // Auto-scroll to bottom on first load / conversation change (not when loading earlier)
  useEffect(() => {
    stickToBottomRef.current = true;
  }, [conversation.id]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    if (query.isFetchingNextPage) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, conversation.id, query.isFetchingNextPage, query.isPending]);

  const err = query.error as (Error & { code?: string }) | null;
  const errorMessage = err ? mapThreadError(err.code, err.message, t) : null;

  const onLoadEarlier = () => {
    stickToBottomRef.current = false;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    void query.fetchNextPage().then(() => {
      requestAnimationFrame(() => {
        if (!el) return;
        const nextHeight = el.scrollHeight;
        el.scrollTop = nextHeight - prevHeight;
      });
    });
  };

  return (
    <div className="flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
          {buyer?.avatar ? (
            <img src={buyer.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
              {title.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {buyer?.buyer_platform && (
            <p className="truncate text-[11px] text-muted-foreground">
              {buyer.buyer_platform === 'TOKOPEDIA'
                ? t('operations.ecommerceChat.tiktok.platform.tokopedia')
                : t('operations.ecommerceChat.tiktok.platform.tiktokShop')}
            </p>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {query.hasNextPage && (
          <div className="flex justify-center pb-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={query.isFetchingNextPage}
              onClick={onLoadEarlier}
            >
              {query.isFetchingNextPage && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
              )}
              {t('operations.ecommerceChat.tiktok.thread.loadEarlier')}
            </Button>
          </div>
        )}

        {query.isPending ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('operations.ecommerceChat.tiktok.thread.loading')}
          </div>
        ) : errorMessage ? (
          <div className="space-y-2 py-10 text-center">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void query.refetch()}
            >
              {t('operations.ecommerceChat.tiktok.retry')}
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {t('operations.ecommerceChat.tiktok.thread.empty')}
          </p>
        ) : (
          messages.map((msg) => (
            <TikTokMessageBubble
              key={msg.id}
              message={msg}
              unsupportedTip={unsupportedTip}
            />
          ))
        )}
      </div>

      <TikTokMessageComposer
        organizationId={organizationId}
        accountId={accountId}
        conversationId={conversation.id}
        canSend={conversation.can_send_message !== false}
        onSent={() => {
          stickToBottomRef.current = true;
        }}
      />
    </div>
  );
}
