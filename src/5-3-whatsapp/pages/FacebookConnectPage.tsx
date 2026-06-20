import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useFacebookPages } from '../hooks/useFacebookPages';
import { MetaScopeStatusCards } from '@/meta-platform/components/MetaScopeStatusCards';
import { WebhookInfoDisplay } from '../components/connect/WebhookInfoDisplay';
import { useMetaOAuthConnect } from '@/meta-platform/hooks/useMetaOAuthConnect';
import { CONNECT_FACEBOOK_PATH } from '../constants/omnichannelIntegrationPaths';
import { FacebookConnectPageSkeleton } from '../skeletons/FacebookConnectPageSkeleton';
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
      if (fbSynced > 0 || igSynced > 0) {
        toast.success(t('facebookConnect.oauthSuccess', 'Facebook Page connected.'));
      } else {
        toast.warning(
          t('facebookConnect.zeroPagesWarning', 'Login OK, but no Facebook Page found.'),
          { duration: 10000 },
        );
      }
      if (resData.warning?.trim()) {
        toast.info(resData.warning.trim(), { duration: 10000 });
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

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="relative flex min-h-full min-w-0 flex-1 flex-col">
              <div
                className={
                  showPageSkeleton
                    ? 'invisible pointer-events-none flex min-h-full min-w-0 flex-1 flex-col'
                    : 'flex min-h-full min-w-0 flex-1 flex-col'
                }
                aria-hidden={showPageSkeleton}
              >
                <div className="mb-1 min-w-0 shrink-0">
                  <HeaderAndTab />
                </div>

                <ModuleShellContentGate pagePath={CONNECT_FACEBOOK_PATH}>
                  <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                    <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_3fr] md:items-stretch">
                          <Card className="flex h-full min-h-0 min-w-0 flex-col">
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
                                  <MetaScopeStatusCards
                                    accounts={connectedPages}
                                    features={['pages', 'comments', 'insights', 'messenger_dm']}
                                  />
                                  <WebhookInfoDisplay variant="facebook" embedded />
                                </>
                              )}
                            </CardContent>
                          </Card>

                          <Card className="flex h-full min-h-0 min-w-0 flex-col">
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
                          </Card>
                        </div>
                      </div>
                    </div>
                  </div>
                </ModuleShellContentGate>
              </div>

              {showPageSkeleton && (
                <div
                  className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-surface-muted"
                  aria-busy
                  aria-label={t('facebookConnect.loading', 'Loading…')}
                >
                  <span className="sr-only">{t('facebookConnect.loading', 'Loading…')}</span>
                  <FacebookConnectPageSkeleton mode="overlay" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
