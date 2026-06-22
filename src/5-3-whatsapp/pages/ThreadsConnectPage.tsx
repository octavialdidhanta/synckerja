import { Link } from 'react-router-dom';
import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useInstagramAccounts } from '../hooks/useInstagramAccounts';
import { useThreadsContentSettings } from '@/threads-content/hooks/useThreadsContentSettings';
import { useThreadsOAuthConnect } from '@/meta-platform/hooks/useThreadsOAuthConnect';
import { hasThreadsOAuthConfig, isThreadsRedirectHttps } from '@/meta-platform/constants/threadsAppEnv';
import {
  hasThreadsScopes,
  missingScopesForFeature,
} from '@/meta-platform/constants/metaOAuthScopes';
import { MetaScopeStatusCards } from '@/meta-platform/components/MetaScopeStatusCards';
import { cn } from '@/shared/lib/utils';
import { CONNECT_INSTAGRAM_PATH, CONNECT_THREADS_PATH } from '../constants/omnichannelIntegrationPaths';
import { ThreadsConnectPageSkeleton } from '../skeletons/ThreadsConnectPageSkeleton';
import { useThreadsConnectPageSkeletonGate } from '../hooks/useThreadsConnectPageSkeletonGate';
import { WebhookInfoDisplay } from '../components/connect/WebhookInfoDisplay';
import { AtSign, CheckCircle2, Instagram, Loader2 } from 'lucide-react';

function parseGrantedScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

/** `/omnichannel/integrations/threads` — Threads API OAuth (separate from Facebook Login). */
export function ThreadsConnectPage() {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const hasOrg = Boolean(organizationId);
  const { accounts: connectedAccounts, isLoading: accountsLoading, refetch } = useInstagramAccounts();
  const threadsSettingsQuery = useThreadsContentSettings(organizationId, { enabled: hasOrg });
  const threadsSettingsAccount = threadsSettingsQuery.data?.accounts?.[0] ?? null;

  const blockingPagePending =
    orgLoading || (hasOrg && accountsLoading) || (hasOrg && threadsSettingsQuery.isLoading);
  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    blockingPagePending,
    CONNECT_THREADS_PATH,
  );
  const showPageSkeleton = useThreadsConnectPageSkeletonGate(showFullPageSkeleton);

  const threadsHttpsOk = isThreadsRedirectHttps();
  const hasInstagramConnected = connectedAccounts.length > 0;
  const primaryGranted =
    threadsSettingsAccount?.granted_scopes ??
    (connectedAccounts.length > 0 ? parseGrantedScopes(connectedAccounts[0].granted_scopes) : []);
  const threadsScopesGranted = hasThreadsScopes(primaryGranted);
  const missingReplyScopes = missingScopesForFeature(primaryGranted, 'threads_replies');
  const lacksContentPublish = !primaryGranted.some(
    (s) => s.toLowerCase() === 'threads_content_publish',
  );
  const repliesScopesComplete =
    !lacksContentPublish &&
    (threadsSettingsAccount?.feature_status?.threads_replies?.ok ?? missingReplyScopes.length === 0);
  const anyAccountHasThreads = connectedAccounts.some((a) => a.has_threads);
  const threadsReady = anyAccountHasThreads && threadsScopesGranted;
  const threadsReplyReady = anyAccountHasThreads && repliesScopesComplete;

  const { startOAuth, oauthLoading } = useThreadsOAuthConnect({
    onExchangeComplete: async () => {
      await Promise.all([refetch(), threadsSettingsQuery.refetch()]);
    },
  });

  const canConnect = hasInstagramConnected && hasThreadsOAuthConfig() && threadsHttpsOk;

  const connectDisabledReason = !hasInstagramConnected
    ? null
    : !hasThreadsOAuthConfig()
      ? t('threadsConnect.appIdMissing', 'VITE_THREADS_APP_ID belum diatur.')
      : !threadsHttpsOk
        ? t('threadsConnect.httpsShort', 'Butuh HTTPS — buka office.synckerja.com.')
        : null;

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3',
          showPageSkeleton && 'pointer-events-none invisible',
        )}
        aria-hidden={showPageSkeleton}
      >
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <ModuleShellContentGate pagePath={CONNECT_THREADS_PATH}>
                  <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                    <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)] lg:items-start">
                          <Card className="flex min-h-0 min-w-0 flex-col lg:max-h-[calc(100vh-180px)]">
                            <CardHeader className="shrink-0 space-y-1 pb-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-900/10">
                                  <AtSign className="h-6 w-6 text-neutral-900" />
                                </div>
                                <div className="min-w-0">
                                  <h2 className="text-lg font-bold text-neutral-900">
                                    {t('threadsConnect.leftTitle', 'Connect Threads')}
                                  </h2>
                                  <p className="text-xs text-muted-foreground">
                                    {t('threadsConnect.leftSubtitle', 'Insights & komentar publik')}
                                  </p>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="scrollbar-hide nested-scroll-touch-chain seamless-scroll flex min-h-0 flex-1 flex-col space-y-3 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              {!hasInstagramConnected ? (
                                <>
                                  <p className="text-sm text-slate-600">
                                    {t('threadsConnect.noInstagramShort', 'Hubungkan Instagram dulu.')}
                                  </p>
                                  <Button asChild variant="outline" className="w-full">
                                    <Link to={CONNECT_INSTAGRAM_PATH}>
                                      {t('threadsConnect.goToInstagram', 'Ke Connect Instagram')}
                                    </Link>
                                  </Button>
                                </>
                              ) : threadsReady ? (
                                !threadsReplyReady ? (
                                  <>
                                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-900">
                                      {t(
                                        'threadsConnect.partialScopesShort',
                                        'Threads terhubung sebagian. Hubungkan ulang untuk mengaktifkan balasan komentar.',
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      onClick={() => void startOAuth()}
                                      disabled={!canConnect || oauthLoading}
                                      className="w-full bg-black hover:bg-neutral-800 text-white"
                                    >
                                      {oauthLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <AtSign className="mr-2 h-4 w-4" />
                                      )}
                                      {oauthLoading
                                        ? t('threadsConnect.connecting', 'Menghubungkan…')
                                        : t('threadsConnect.reconnect', 'Hubungkan ulang')}
                                    </Button>
                                  </>
                                ) : null
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    onClick={() => void startOAuth()}
                                    disabled={!canConnect || oauthLoading}
                                    className="w-full bg-black hover:bg-neutral-800 text-white"
                                  >
                                    {oauthLoading ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <AtSign className="mr-2 h-4 w-4" />
                                    )}
                                    {oauthLoading
                                      ? t('threadsConnect.connecting', 'Menghubungkan…')
                                      : anyAccountHasThreads
                                        ? t('threadsConnect.reconnect', 'Hubungkan ulang')
                                        : t('threadsConnect.connectButton', 'Connect Threads')}
                                  </Button>
                                  {connectDisabledReason ? (
                                    <p className="text-xs text-amber-700">{connectDisabledReason}</p>
                                  ) : null}
                                </>
                              )}

                              {hasInstagramConnected && threadsReady ? (
                                <>
                                  <MetaScopeStatusCards
                                    accounts={connectedAccounts}
                                    features={['threads_insights', 'threads_replies']}
                                    compact
                                    hideMissingDetails
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void startOAuth()}
                                    disabled={!canConnect || oauthLoading}
                                    className="w-full"
                                  >
                                    {oauthLoading ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <AtSign className="mr-2 h-4 w-4" />
                                    )}
                                    {t('threadsConnect.reconnect', 'Hubungkan ulang')}
                                  </Button>
                                </>
                              ) : null}

                              {hasInstagramConnected && threadsReady ? (
                                <details className="group border-t border-slate-200 pt-3">
                                  <summary className="cursor-pointer list-none text-xs font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
                                    {t('threadsConnect.webhookManualSetup', 'Webhook Meta (opsional)')}
                                  </summary>
                                  <div className="mt-2 min-w-0">
                                    <WebhookInfoDisplay embedded variant="threads" compact />
                                  </div>
                                </details>
                              ) : null}
                            </CardContent>
                          </Card>

                          <Card className="flex min-h-0 min-w-0 flex-col">
                            <CardHeader className="shrink-0 pb-3">
                              <CardTitle className="text-base">
                                {t('threadsConnect.rightTitle', 'Akun Instagram')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col">
                              {connectedAccounts.length === 0 ? (
                                <div className="flex min-h-[12rem] flex-col items-center justify-center px-4 py-8 text-center">
                                  <Instagram className="mb-3 h-10 w-10 text-slate-300" />
                                  <p className="text-sm text-slate-600">
                                    {t('threadsConnect.noAccounts', 'Belum ada akun.')}
                                  </p>
                                </div>
                              ) : (
                                <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                  {(() => {
                                    const seenThreadsUserIds = new Set<string>();
                                    return connectedAccounts.map((acc) => {
                                      const threadsUserId = acc.threads_user_id?.trim() ?? '';
                                      const showThreadsLine =
                                        acc.has_threads &&
                                        Boolean(acc.threads_username?.trim()) &&
                                        threadsUserId &&
                                        !seenThreadsUserIds.has(threadsUserId);
                                      if (showThreadsLine) seenThreadsUserIds.add(threadsUserId);
                                      return (
                                        <div
                                          key={acc.id}
                                          className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3"
                                        >
                                          <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E4405F]/15">
                                              <Instagram className="h-5 w-5 text-[#E4405F]" />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="truncate font-medium text-slate-900">
                                                {acc.instagram_username
                                                  ? `@${acc.instagram_username}`
                                                  : acc.instagram_name || acc.instagram_business_account_id}
                                              </p>
                                              {showThreadsLine ? (
                                                <p className="truncate text-xs text-slate-500">
                                                  Threads @{acc.threads_username}
                                                </p>
                                              ) : acc.has_threads ? (
                                                <p className="truncate text-xs text-slate-500">
                                                  {t(
                                                    'threadsConnect.threadsSharedProfile',
                                                    'Threads profile shared with linked IG above',
                                                  )}
                                                </p>
                                              ) : null}
                                            </div>
                                          </div>
                                          {acc.has_threads ? (
                                            <CheckCircle2
                                              className="h-5 w-5 shrink-0 text-emerald-600"
                                              aria-label={t('threadsConnect.threadsLinked', 'Terhubung')}
                                            />
                                          ) : (
                                            <span className="shrink-0 text-xs font-medium text-amber-600">
                                              {t('threadsConnect.threadsPending', 'Belum')}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    });
                                  })()}
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
          </div>
        </div>
      </div>

      {showPageSkeleton ? (
        <div
          className="absolute inset-0 z-10 min-h-0 overflow-hidden"
          aria-busy
          aria-label={t('threadsConnect.loading', 'Memuat…')}
        >
          <ThreadsConnectPageSkeleton />
          <span className="sr-only">{t('threadsConnect.loading', 'Memuat…')}</span>
        </div>
      ) : null}
    </div>
  );
}
