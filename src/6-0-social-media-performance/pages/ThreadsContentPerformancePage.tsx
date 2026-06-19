import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
import { SocialMediaPerformanceHeaderAndTab } from '@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useOmnichannelSurveySettingsAdmin } from '@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin';
import { useDigitalMarketingPaidAdsFilters } from '@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { ThreadsContentAccountNav } from '@/6-0-social-media-performance/components/ThreadsContentAccountNav';
import { ThreadsContentSummaryBar } from '@/6-0-social-media-performance/components/ThreadsContentSummaryBar';
import { ThreadsContentPostsTable } from '@/6-0-social-media-performance/components/ThreadsContentPostsTable';
import { ThreadsContentPerformancePageSkeleton } from '@/6-0-social-media-performance/skeletons/ThreadsContentPerformancePageSkeleton';
import { useThreadsContentSettings } from '@/threads-content/hooks/useThreadsContentSettings';
import { useThreadsContentMetricsQuery } from '@/threads-content/hooks/useThreadsContentMetrics';
import { CONNECT_INSTAGRAM_PATH } from '@/threads-content/settings/threadsContentSettingsPaths';
import { TikTokAdsDateRangePicker } from '@/6-0-tiktok-ads/components/TikTokAdsDateRangePicker';
import { buildTikTokAdsCalendarYearPresetYears } from '@/tiktok-ads/lib/clampTikTokAdsDateRange';
import { toTikTokAdsMetricsDateRangePayload } from '@/tiktok-ads/lib/toTikTokAdsMetricsDateRangePayload';

const SOCIAL_MEDIA_PERFORMANCE_PATH = '/digital-marketing/social-media-performance';

export default function ThreadsContentPerformancePage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <ThreadsContentPerformancePageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={SOCIAL_MEDIA_PERFORMANCE_PATH}>
      <ThreadsContentPerformancePageContent />
    </ModuleShellContentGate>
  );
}

function ThreadsContentPerformancePageContent() {
  const { t } = useTranslation();
  const { organizationId, gatePending } = useOmnichannelSurveySettingsAdmin();
  const settingsQuery = useThreadsContentSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });
  const { dateSelection, setDateSelection } = useDigitalMarketingPaidAdsFilters();
  const [accountId, setAccountId] = useState('');

  const accounts = useMemo(() => settingsQuery.data?.accounts ?? [], [settingsQuery.data?.accounts]);

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].account_id);
    }
  }, [accounts, accountId]);

  const datePayload = useMemo(
    () => toTikTokAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );

  const metricsQuery = useThreadsContentMetricsQuery({
    organizationId,
    accountId,
    dateStart: datePayload.start,
    dateEnd: datePayload.end,
    enabled: Boolean(organizationId && accountId && settingsQuery.data?.oauthConnected),
  });

  const calendarYearPresetYears = useMemo(() => buildTikTokAdsCalendarYearPresetYears(), []);
  const metricsLoading = metricsQuery.isLoading || metricsQuery.isFetching;

  if (gatePending || settingsQuery.isPending) {
    return <ThreadsContentPerformancePageSkeleton />;
  }

  const notConnected = !settingsQuery.data?.oauthConnected;

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="mb-1 shrink-0">
          <SocialMediaPerformanceHeaderAndTab />
        </div>
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-[calc(100vh-120px)] min-w-0 flex-1 flex-col">
            <div className="flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {notConnected ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <p className="mb-4 text-sm text-slate-600">
                    {t(
                      'digitalMarketing.threadsContent.notConnectedDesc',
                      'Reconnect Instagram to grant Threads permissions.',
                    )}
                  </p>
                  <Button asChild>
                    <Link to={CONNECT_INSTAGRAM_PATH}>
                      {t('digitalMarketing.threadsContent.openConnect', 'Connect Instagram / Threads')}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
                  <ThreadsContentAccountNav
                    accounts={accounts}
                    accountId={accountId}
                    onAccountIdChange={setAccountId}
                  />
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <div className="shrink-0 space-y-3 border-b border-gray-200 p-4">
                      {settingsQuery.data?.serverConfigured === false ? (
                        <Alert variant="destructive">
                          <AlertTitle>
                            {t('digitalMarketing.threadsContent.serverNotConfigured', 'Server not configured')}
                          </AlertTitle>
                          <AlertDescription>
                            {t(
                              'digitalMarketing.threadsContent.serverNotConfiguredDesc',
                              'Set THREADS_APP_ID and THREADS_APP_SECRET in Supabase Edge Function secrets.',
                            )}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={t('digitalMarketing.threadsContent.refresh', 'Refresh')}
                          disabled={!accountId || metricsQuery.isFetching}
                          onClick={() => void metricsQuery.refetch()}
                        >
                          {metricsQuery.isFetching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <TikTokAdsDateRangePicker
                          value={dateSelection}
                          onChange={setDateSelection}
                          calendarYearPresetYears={calendarYearPresetYears}
                        />
                      </div>
                    </div>
                    <ThreadsContentSummaryBar account={metricsQuery.data?.account} isLoading={metricsLoading} />
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      {metricsQuery.isError ? (
                        <div className="p-4">
                          <Alert variant="destructive">
                            <AlertTitle>
                              {t('digitalMarketing.threadsContent.error', 'Failed to load posts')}
                            </AlertTitle>
                            <AlertDescription>{(metricsQuery.error as Error)?.message}</AlertDescription>
                          </Alert>
                        </div>
                      ) : (
                        <ThreadsContentPostsTable rows={metricsQuery.data?.posts ?? []} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
