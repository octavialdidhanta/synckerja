import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Inbox, Loader2, ShoppingBag } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { TIKTOK_SHOP_SETTINGS_PATH } from '@/tiktok-shop/settings/tiktokShopSettingsPaths';
import { useTikTokShopConnected } from '@/tiktok-shop/hooks/useTikTokShopConnected';
import {
  useTikTokShopSettings,
  type TikTokShopAccountRow,
} from '@/tiktok-shop/hooks/useTikTokShopSettings';
import { useTikTokShopConversations } from '../../hooks/useTikTokShopConversations';
import { useTikTokShopCsRealtime } from '../../hooks/useTikTokShopCsRealtime';
import { TikTokConversationList } from './TikTokConversationList';
import { TikTokConversationThread } from './TikTokConversationThread';
import type { TikTokConversation } from './tiktokConversation.types';

type Props = {
  organizationId: string | null | undefined;
};

function flattenShops(
  sellers: { shops: TikTokShopAccountRow[] }[] | undefined,
): TikTokShopAccountRow[] {
  const shops = (sellers ?? []).flatMap((s) => s.shops ?? []);
  return shops.filter((s) => s.is_active !== false);
}

function pickDefaultAccountId(shops: TikTokShopAccountRow[]): string | null {
  if (shops.length === 0) return null;
  const def = shops.find((s) => s.is_default);
  return (def ?? shops[0])?.id ?? null;
}

function mapConversationError(code: string | undefined, fallback: string, t: (k: string) => string) {
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

export function TikTokConversationsInbox({ organizationId }: Props) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const deepAccount = searchParams.get('account')?.trim() || '';
  const deepConversation = searchParams.get('conversation')?.trim() || '';

  const { data: connected = false, isPending: connectedPending } =
    useTikTokShopConnected(organizationId);
  const { data: settings, isPending: settingsPending } = useTikTokShopSettings(organizationId, {
    enabled: Boolean(organizationId),
  });

  const shops = useMemo(() => flattenShops(settings?.sellers), [settings?.sellers]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (shops.length === 0) return;
    if (deepAccount && shops.some((s) => s.id === deepAccount)) {
      setAccountId(deepAccount);
      return;
    }
    if (!accountId) {
      setAccountId(pickDefaultAccountId(shops));
      return;
    }
    if (!shops.some((s) => s.id === accountId)) {
      setAccountId(pickDefaultAccountId(shops));
    }
  }, [shops, accountId, deepAccount]);

  useEffect(() => {
    if (
      deepConversation &&
      accountId &&
      (!deepAccount || accountId === deepAccount)
    ) {
      setSelectedId(deepConversation);
    }
  }, [deepConversation, deepAccount, accountId]);

  const conversationsQuery = useTikTokShopConversations(organizationId, accountId, {
    enabled: connected && Boolean(accountId),
  });

  useTikTokShopCsRealtime(organizationId, accountId, selectedId, {
    enabled: connected && Boolean(accountId),
  });

  const conversations = useMemo(() => {
    const pages = conversationsQuery.data?.pages ?? [];
    const map = new Map<string, TikTokConversation>();
    for (const page of pages) {
      for (const c of page.conversations) {
        if (c.id) map.set(c.id, c);
      }
    }
    return Array.from(map.values());
  }, [conversationsQuery.data?.pages]);

  const selected =
    conversations.find((c) => c.id === selectedId) ??
    (selectedId
      ? ({
          id: selectedId,
          can_send_message: true,
          unread_count: 0,
        } satisfies TikTokConversation)
      : null);
  const loading = connectedPending || settingsPending;
  const title = t('operations.ecommerceChat.inboxTitlePlatform', {
    platform: t('operations.ecommerceChat.platforms.tiktok'),
  });

  const handleAccountChange = (nextAccountId: string) => {
    setAccountId(nextAccountId);
    if (!(deepAccount && nextAccountId === deepAccount && deepConversation)) {
      setSelectedId(null);
    }
  };

  if (!organizationId) {
    return (
      <p className="text-sm text-muted-foreground">{t('operations.ecommerceChat.tiktok.noOrg')}</p>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[560px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('operations.ecommerceChat.tiktok.loading')}
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:col-span-4">
          <div className="flex min-h-[560px] min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
            <div className="flex-shrink-0 border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('operations.ecommerceChat.tiktok.inboxHint')}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">
                    {t('operations.ecommerceChat.platforms.tiktok')}
                  </span>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {t('operations.ecommerceChat.status.notConnected')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('operations.ecommerceChat.tiktok.connectHint')}
              </p>
              <Button type="button" size="sm" className="mt-3" asChild>
                <Link to={TIKTOK_SHOP_SETTINGS_PATH}>
                  {t('operations.ecommerceChat.tiktok.connectCta')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col lg:col-span-8">
          <div className="flex min-h-[560px] min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-10 text-center shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
            <Inbox className="h-10 w-10 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              {t('operations.ecommerceChat.tiktok.emptyTitle')}
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {t('operations.ecommerceChat.tiktok.emptyBody')}
            </p>
            <Button asChild size="sm" className="mt-2">
              <Link to={TIKTOK_SHOP_SETTINGS_PATH}>
                {t('operations.ecommerceChat.tiktok.connectCta')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const err = conversationsQuery.error as (Error & { code?: string }) | null;
  const errorMessage = err
    ? mapConversationError(err.code, err.message, t)
    : null;

  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:col-span-4">
        <div className="flex min-h-[560px] min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
          <div className="flex-shrink-0 space-y-2 border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <Badge variant="default" className="shrink-0 text-[10px]">
                {t('operations.ecommerceChat.status.connected')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('operations.ecommerceChat.tiktok.inboxHint')}
            </p>
            {shops.length > 0 && (
              <div className="pt-1">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  {t('operations.ecommerceChat.tiktok.shopSelector')}
                </label>
                <Select
                  value={accountId ?? undefined}
                  onValueChange={handleAccountChange}
                >
                  <SelectTrigger className="h-9 w-full text-sm">
                    <SelectValue
                      placeholder={t('operations.ecommerceChat.tiktok.shopSelectorPlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.map((shop) => (
                      <SelectItem key={shop.id} value={shop.id}>
                        {shop.shop_name?.trim() || shop.label || shop.shop_id}
                        {shop.is_default
                          ? ` (${t('operations.ecommerceChat.tiktok.defaultShop')})`
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversationsQuery.isPending ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('operations.ecommerceChat.tiktok.loadingConversations')}
              </div>
            ) : errorMessage ? (
              <div className="space-y-2 px-4 py-6 text-center">
                <p className="text-sm text-destructive">{errorMessage}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void conversationsQuery.refetch()}
                >
                  {t('operations.ecommerceChat.tiktok.retry')}
                </Button>
              </div>
            ) : (
              <TikTokConversationList
                conversations={conversations}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>

          {conversationsQuery.hasNextPage && !errorMessage && (
            <div className="flex-shrink-0 border-t border-border p-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full"
                disabled={conversationsQuery.isFetchingNextPage}
                onClick={() => void conversationsQuery.fetchNextPage()}
              >
                {conversationsQuery.isFetchingNextPage && (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                )}
                {t('operations.ecommerceChat.tiktok.loadMore')}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col lg:col-span-8">
        {selected && accountId ? (
          <TikTokConversationThread
            organizationId={organizationId}
            accountId={accountId}
            conversation={selected}
          />
        ) : (
          <div className="flex min-h-[560px] min-w-0 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/60 px-6 py-10 text-center shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              {t('operations.ecommerceChat.threadPlaceholderTitle')}
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              {t('operations.ecommerceChat.tiktok.threadPlaceholderBody')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
