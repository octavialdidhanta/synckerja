import { Inbox, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { BLIBLI_ORDERS_SETTINGS_PATH } from '@/blibli-orders/lib/blibliOrdersPaths';
import type { EcommerceChatPlatform } from '../lib/ecommerceChatPaths';
import { ECOMMERCE_CHAT_CHANNELS } from '../types/ecommerceChat.types';
import { useBlibliSellerSettings } from '../hooks/useBlibliSellerSettings';
import { useTikTokShopConnected } from '@/tiktok-shop/hooks/useTikTokShopConnected';
import { BlibliSellerConnectPanel } from './BlibliSellerConnectPanel';
import { BlibliSellerChatFrame } from './BlibliSellerChatFrame';
import { TikTokConversationsInbox } from './tiktok-inbox/TikTokConversationsInbox';

type Props = {
  platform: EcommerceChatPlatform;
};

export function EcommerceChatInboxPanel({ platform }: Props) {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const blibliEnabled = platform === 'blibli' || platform === 'all';
  const tiktokEnabled = platform === 'tiktok' || platform === 'all';
  const { data: blibliSettings } = useBlibliSellerSettings(organizationId, {
    enabled: blibliEnabled,
  });
  const { data: tiktokConnected = false } = useTikTokShopConnected(
    tiktokEnabled ? organizationId : null,
  );
  const blibliConnected = Boolean(blibliSettings?.connected);
  const defaultBlibliConnectionId =
    blibliSettings?.connections?.find((c) => c.is_default)?.id ??
    blibliSettings?.connections?.[0]?.id ??
    null;

  const channels =
    platform === 'all'
      ? ECOMMERCE_CHAT_CHANNELS
      : ECOMMERCE_CHAT_CHANNELS.filter((c) => c.id === platform);

  const title =
    platform === 'all'
      ? t('operations.ecommerceChat.inboxTitleAll')
      : t('operations.ecommerceChat.inboxTitlePlatform', {
          platform: t(`operations.ecommerceChat.platforms.${platform}`),
        });

  if (platform === 'tiktok') {
    return <TikTokConversationsInbox organizationId={organizationId} />;
  }

  if (platform === 'blibli') {
    return (
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:col-span-4">
          <div className="flex min-h-[560px] min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
            <div className="flex-shrink-0 border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('operations.ecommerceChat.blibli.inboxHint')}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">
                    {t('operations.ecommerceChat.platforms.blibli')}
                  </span>
                </div>
                <Badge variant={blibliConnected ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                  {t(
                    blibliConnected
                      ? 'operations.ecommerceChat.status.connected'
                      : 'operations.ecommerceChat.status.notConnected',
                  )}
                </Badge>
              </div>
              <BlibliSellerConnectPanel organizationId={organizationId} compact />
            </div>
          </div>
        </div>

        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col lg:col-span-8">
          <div className="flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
            {blibliConnected ? (
              <BlibliSellerChatFrame
                organizationId={organizationId}
                connectionId={defaultBlibliConnectionId}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                <Inbox className="h-10 w-10 text-muted-foreground/50" aria-hidden />
                <p className="text-sm font-medium text-foreground">
                  {t('operations.ecommerceChat.blibli.emptyTitle')}
                </p>
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                  {t('operations.ecommerceChat.blibli.emptyBody')}
                </p>
                <Button asChild size="sm" className="mt-2">
                  <Link to={BLIBLI_ORDERS_SETTINGS_PATH}>
                    {t('operations.ecommerceChat.blibli.connectCta')}
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:col-span-4">
        <div className="flex min-h-[560px] min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
          <div className="flex-shrink-0 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('operations.ecommerceChat.inboxHint')}
            </p>
          </div>

          <ul className="flex-shrink-0 space-y-2 border-b border-border p-3">
            {channels.map((channel) => {
              const statusKey =
                channel.id === 'blibli' && blibliConnected
                  ? 'connected'
                  : channel.id === 'tiktok' && tiktokConnected
                    ? 'connected'
                    : channel.statusKey;
              return (
                <li
                  key={channel.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">
                      {t(`operations.ecommerceChat.platforms.${channel.labelKey}`)}
                    </span>
                  </div>
                  <Badge
                    variant={statusKey === 'connected' ? 'default' : 'secondary'}
                    className="shrink-0 text-[10px]"
                  >
                    {t(`operations.ecommerceChat.status.${statusKey}`)}
                  </Badge>
                </li>
              );
            })}
          </ul>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              {t('operations.ecommerceChat.emptyTitle')}
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {t('operations.ecommerceChat.emptyBody')}
            </p>
          </div>
        </div>
      </div>

      <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col lg:col-span-8">
        <div className="flex min-h-[560px] min-w-0 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/60 px-6 py-10 text-center shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
          <MessagePlaceholder />
          <p className="mt-3 text-sm font-medium text-foreground">
            {t('operations.ecommerceChat.threadPlaceholderTitle')}
          </p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            {t('operations.ecommerceChat.threadPlaceholderBody')}
          </p>
        </div>
      </div>
    </div>
  );
}

function MessagePlaceholder() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
      <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
    </div>
  );
}
