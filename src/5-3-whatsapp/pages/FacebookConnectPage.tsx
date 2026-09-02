import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useFacebookPages } from '../hooks/useFacebookPages';
import { WebhookInfoDisplay } from '../components/connect/WebhookInfoDisplay';
import { notifyMetaOAuthExchangeWarnings } from '@/meta-platform/lib/notifyMetaOAuthExchangeResult';
import { useMetaOAuthConnect } from '@/meta-platform/hooks/useMetaOAuthConnect';
import { MetaReconnectBanner } from '@/meta-platform/components/MetaReconnectBanner';
import { MetaScopeStatusCards } from '@/meta-platform/components/MetaScopeStatusCards';
import { anyAccountNeedsMetaReconnect } from '@/meta-platform/lib/metaReconnectStatus';
import { cn } from '@/shared/lib/utils';
import { CONNECT_FACEBOOK_PATH } from '../constants/omnichannelIntegrationPaths';
import { FacebookConnectPageSkeleton } from '../skeletons/FacebookConnectPageSkeleton';
import { IntegrationsWorkspace } from '../layout/IntegrationsWorkspace';
import { useFacebookConnectPageSkeletonGate } from '../hooks/useFacebookConnectPageSkeletonGate';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Facebook, Loader2, Unplug } from 'lucide-react';
import { toast } from 'sonner';

/** `/omnichannel/integrations/facebook` — Facebook Page via Meta Business Login. */
export function FacebookConnectPage() {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const hasOrg = Boolean(organizationId);
  const {
    pages: connectedPages,
    isLoading: pagesLoading,
    refetch,
    disconnectPage,
    isDisconnecting,
    subscribeMessengerWebhooks,
    isSubscribingWebhooks,
  } = useFacebookPages();

  const blockingPagePending = orgLoading || (hasOrg && pagesLoading);
  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    blockingPagePending,
    CONNECT_FACEBOOK_PATH,
  );
  const showPageSkeleton = useFacebookConnectPageSkeletonGate(showFullPageSkeleton);

  const { startOAuth, oauthLoading, hasOAuth } = useMetaOAuthConnect({
    flow: 'facebook',
    onExchangeComplete: async (resData) => {
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['meta-content-config', organizationId] });
      const fbSynced =
        typeof resData.facebook_pages_synced === 'number' ? resData.facebook_pages_synced : 0;
      const igSynced = typeof resData.accounts_synced === 'number' ? resData.accounts_synced : 0;
      const synced = fbSynced + igSynced;
      const webhookSynced =
        typeof resData.webhook_subscribed_count === 'number' ? resData.webhook_subscribed_count : 0;
      if (synced > 0) {
        if (webhookSynced >= synced) {
          toast.success(t('facebookConnect.oauthSuccess', 'Facebook Page connected.'));
        } else {
          notifyMetaOAuthExchangeWarnings(t, resData);
        }
      } else {
        toast.warning(
          t('facebookConnect.zeroPagesWarning', 'Login OK, but no Facebook Page found.'),
          { duration: 10000 },
        );
      }
    },
  });

  const handleDisconnect = async (pageId: string) => {
    try {
      await disconnectPage(pageId);
      toast.success(t('facebookConnect.disconnected', 'Disconnected'));
    } catch (e) {
      toast.error((e as Error)?.message ?? t('common.error', 'Error'));
    }
  };

  const handleSubscribeWebhooks = async () => {
    try {
      const sub = await subscribeMessengerWebhooks();
      const fields = sub.results?.flatMap((r) => r.subscribedFields ?? []) ?? [];
      const hasMessages = fields.includes('messages');
      const hasFeed = fields.includes('feed');
      if (sub.success !== false && (sub.subscribed_count ?? 0) > 0 && hasMessages && hasFeed) {
        toast.success(
          t(
            'facebookConnect.webhookSubscribeSuccess',
            'Page webhooks enabled (Messenger + FB comments). You can test Lead Magnet on Facebook posts.',
          ),
        );
      } else if (sub.success !== false && (sub.subscribed_count ?? 0) > 0 && hasMessages) {
        toast.warning(
          t(
            'facebookConnect.webhookSubscribePartialFeed',
            'Messenger webhook enabled, but "feed" field missing — FB comment automation will not work. Try again or reconnect Facebook.',
          ),
          { duration: 12000 },
        );
      } else if (sub.success !== false && (sub.subscribed_count ?? 0) > 0) {
        toast.warning(
          t(
            'facebookConnect.webhookSubscribePartial',
            'Webhook subscribed but "messages" field missing. Reconnect Facebook or check Meta Developer → Webhooks → Page.',
          ),
          { duration: 12000 },
        );
      } else {
        toast.error(sub.error ?? t('facebookConnect.webhookSubscribeFailed', 'Failed to enable Messenger webhooks.'));
      }
    } catch (e) {
      toast.error((e as Error)?.message ?? t('facebookConnect.webhookSubscribeFailed', 'Failed to enable Messenger webhooks.'));
    }
  };

  const showReconnectBanner =
    connectedPages.length > 0 &&
    anyAccountNeedsMetaReconnect(connectedPages, 'messenger_dm');

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3',
          showPageSkeleton && 'pointer-events-none invisible',
        )}
        aria-hidden={showPageSkeleton}
      >
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <ModuleShellContentGate pagePath={CONNECT_FACEBOOK_PATH}>
              <IntegrationsWorkspace
                count={connectedPages.length}
                sectionLabel={t('facebookConnect.tabTitle', 'Connect Facebook Page')}
                left={
                          <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
                            <CardHeader className="shrink-0">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#1877F2]/15">
                                  <Facebook className="h-8 w-8 text-[#1877F2]" />
                                </div>
                                <h2 className="text-xl font-bold text-[#1877F2]">
                                  {t('facebookConnect.leftTitle', 'Connect Facebook Page')}
                                </h2>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {showReconnectBanner && (
                                <MetaReconnectBanner
                                  variant="facebook"
                                  reconnecting={oauthLoading}
                                  onReconnect={() => void startOAuth({ rerequest: true })}
                                />
                              )}
                              {connectedPages.length > 0 && (
                                <MetaScopeStatusCards
                                  accounts={connectedPages}
                                  features={['messenger_dm', 'pages', 'facebook_publish']}
                                  compact
                                  hideMissingDetails
                                />
                              )}
                              {!hasOAuth ? (
                                <p className="text-xs text-amber-700">
                                  {t('instagramConnect.oauthNotConfigured', 'VITE_META_APP_ID not set.')}
                                </p>
                              ) : (
                                <Button
                                  type="button"
                                  onClick={() => void startOAuth()}
                                  disabled={oauthLoading}
                                  className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
                                >
                                  {oauthLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Facebook className="mr-2 h-4 w-4" />
                                  )}
                                  {oauthLoading
                                    ? t('facebookConnect.connecting', 'Connecting…')
                                    : connectedPages.length > 0
                                      ? t('facebookConnect.reconnect', 'Connect again')
                                      : t('facebookConnect.connectButton', 'Connect with Facebook')}
                                </Button>
                              )}

                              {connectedPages.length > 0 && (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full border-[#1877F2]/40 text-[#1877F2] hover:bg-[#1877F2]/5"
                                    disabled={isSubscribingWebhooks}
                                    onClick={() => void handleSubscribeWebhooks()}
                                  >
                                    {isSubscribingWebhooks ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    {t('facebookConnect.enableMessengerWebhooks', 'Enable Messenger webhooks')}
                                  </Button>
                                  <details className="group border-t border-slate-200 pt-3">
                                    <summary className="cursor-pointer list-none text-xs font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
                                      {t('facebookConnect.webhookManualSetup', 'Meta webhook (manual setup)')}
                                    </summary>
                                    <div className="mt-2">
                                      <WebhookInfoDisplay variant="facebook" embedded compact />
                                    </div>
                                  </details>
                                </>
                              )}
                            </CardContent>
                          </Card>
                }
              >
                            <CardHeader className="shrink-0">
                              <CardTitle>
                                {t('facebookConnect.rightTitle', 'Connected Pages')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="flex min-h-0 flex-1 flex-col">
                              {connectedPages.length === 0 ? (
                                <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                                  <Facebook className="mb-3 h-12 w-12 text-slate-300" />
                                  <p className="text-sm text-slate-600">
                                    {t('facebookConnect.noPages', 'No Page connected yet.')}
                                  </p>
                                </div>
                              ) : (
                                <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                  {connectedPages.map((page) => (
                                    <div
                                      key={page.id}
                                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3"
                                    >
                                      <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/15">
                                          <Facebook className="h-5 w-5 text-[#1877F2]" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="truncate font-medium text-slate-900">
                                            {page.page_name?.trim() || page.facebook_page_id}
                                          </p>
                                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            {t('facebookConnect.connected', 'Connected')}
                                          </span>
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                                        disabled={isDisconnecting}
                                        onClick={() => void handleDisconnect(page.id)}
                                      >
                                        <Unplug className="mr-1.5 h-4 w-4" />
                                        {t('facebookConnect.disconnect', 'Disconnect')}
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
              </IntegrationsWorkspace>
              </ModuleShellContentGate>
            </div>
          </div>
        </div>
      </div>

      {showPageSkeleton ? (
        <div
          className="absolute inset-0 z-10 min-h-0 overflow-hidden"
          aria-busy
          aria-label={t('facebookConnect.loading', 'Loading…')}
        >
          <FacebookConnectPageSkeleton />
          <span className="sr-only">{t('facebookConnect.loading', 'Loading…')}</span>
        </div>
      ) : null}
    </div>
  );
}
