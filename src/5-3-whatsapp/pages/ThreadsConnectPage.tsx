import { Link } from 'react-router-dom';
import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useInstagramAccounts } from '../hooks/useInstagramAccounts';
import { useThreadsOAuthConnect } from '@/meta-platform/hooks/useThreadsOAuthConnect';
import { hasThreadsOAuthConfig, isThreadsRedirectHttps } from '@/meta-platform/constants/threadsAppEnv';
import { hasThreadsScopes } from '@/meta-platform/constants/metaOAuthScopes';
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

  const blockingPagePending = orgLoading || (hasOrg && accountsLoading);
  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    blockingPagePending,
    CONNECT_THREADS_PATH,
  );
  const showPageSkeleton = useThreadsConnectPageSkeletonGate(showFullPageSkeleton);

  const threadsHttpsOk = isThreadsRedirectHttps();
  const hasInstagramConnected = connectedAccounts.length > 0;
  const primaryGranted =
    connectedAccounts.length > 0 ? parseGrantedScopes(connectedAccounts[0].granted_scopes) : [];
  const threadsScopesGranted = hasThreadsScopes(primaryGranted);
  const anyAccountHasThreads = connectedAccounts.some((a) => a.has_threads);
  const threadsReady = anyAccountHasThreads && threadsScopesGranted;

  const { startOAuth, oauthLoading } = useThreadsOAuthConnect({
    onExchangeComplete: async () => {
      await refetch();
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

                <ModuleShellContentGate pagePath={CONNECT_THREADS_PATH}>
                  <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                    <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex min-h-0 flex-1 flex-col gap-6">
                          <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_3fr] md:grid-rows-1 md:items-stretch">
                            <Card className="flex h-full min-h-0 min-w-0 flex-col">
                              <CardHeader className="shrink-0 space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-900/10">
                                    <AtSign className="h-8 w-8 text-neutral-900" />
                                  </div>
                                  <div>
                                    <h2 className="text-xl font-bold text-neutral-900">
                                      {t('threadsConnect.leftTitle', 'Connect Threads')}
                                    </h2>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="flex min-h-0 flex-1 flex-col space-y-3">
                                {!hasInstagramConnected ? (
                                  <div className="space-y-3">
                                    <p className="text-sm text-slate-600">
                                      {t('threadsConnect.noInstagramShort', 'Hubungkan Instagram dulu.')}
                                    </p>
                                    <Button asChild variant="outline" className="w-full">
                                      <Link to={CONNECT_INSTAGRAM_PATH}>
                                        {t('threadsConnect.goToInstagram', 'Ke Connect Instagram')}
                                      </Link>
                                    </Button>
                                  </div>
                                ) : threadsReady ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm text-emerald-800">
                                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                                      {t('threadsConnect.alreadyConnected', 'Threads terhubung.')}
                                    </div>
                                    <Card className="border-slate-200">
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-base">
                                          {t('threadsConnect.manageCommentsTitle', 'Kelola komentar Threads')}
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-2 text-sm text-muted-foreground">
                                        <p>
                                          {t(
                                            'threadsConnect.manageCommentsCopy',
                                            'Threads terhubung untuk insights, balasan publik, dan Manage Comments. Private DM Threads belum didukung API Meta — gunakan Instagram Live Chat untuk pesan DM.',
                                          )}
                                        </p>
                                        <WebhookInfoDisplay embedded variant="threads" />
                                      </CardContent>
                                    </Card>
                                  </div>
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
                                ) : null}
                              </CardContent>
                            </Card>

                            <Card className="flex h-full min-h-0 min-w-0 flex-col">
                              <CardHeader className="shrink-0">
                                <CardTitle>
                                  {t('threadsConnect.rightTitle', 'Akun Instagram')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="flex min-h-0 flex-1 flex-col">
                                {connectedAccounts.length === 0 ? (
                                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                                    <Instagram className="mb-3 h-12 w-12 text-slate-300" />
                                    <p className="text-sm text-slate-600">
                                      {t('threadsConnect.noAccounts', 'Belum ada akun.')}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3"
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
                                                {t('threadsConnect.threadsSharedProfile', 'Threads profile shared with linked IG above')}
                                              </p>
                                            ) : null}
                                          </div>
                                        </div>
                                        {acc.has_threads ? (
                                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label={t('threadsConnect.threadsLinked', 'Terhubung')} />
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
                  </div>
                </ModuleShellContentGate>
              </div>

              {showPageSkeleton && (
                <div
                  className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-surface-muted"
                  aria-busy
                  aria-label={t('threadsConnect.loading', 'Memuat…')}
                >
                  <span className="sr-only">{t('threadsConnect.loading', 'Memuat…')}</span>
                  <ThreadsConnectPageSkeleton mode="overlay" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
