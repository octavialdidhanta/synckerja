import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
import { SocialMediaPerformanceModuleShell } from '@/6-0-social-media-performance/layout/SocialMediaPerformanceModuleShell';
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
import { CONNECT_INSTAGRAM_PATH, CONNECT_THREADS_PATH } from '@/threads-content/settings/threadsContentSettingsPaths';
import { useInstagramAccounts } from '@/5-3-whatsapp/hooks/useInstagramAccounts';
import { ThreadsDateRangePicker } from '@/6-0-social-media-performance/components/ThreadsDateRangePicker';
import { buildThreadsCalendarYearPresetYears, threadsContentMetricsFetchArgs } from '@/threads-content/lib/toThreadsPostDateRangePayload';

const SOCIAL_MEDIA_PERFORMANCE_PATH = '/digital-marketing/social-media-performance';

export default function ThreadsContentPerformancePage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <ThreadsContentPerformancePageSkeleton />;
  return (
    <SocialMediaPerformanceModuleShell>
      <ThreadsContentPerformancePageContent />
    </SocialMediaPerformanceModuleShell>
  );
}

function ThreadsContentPerformancePageContent() {
  const { t } = useTranslation();
  const { organizationId, gatePending } = useOmnichannelSurveySettingsAdmin();
  const settingsQuery = useThreadsContentSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });
  const { accounts: instagramAccounts, isLoading: instagramAccountsLoading } = useInstagramAccounts();
  const { dateSelection, setDateSelection } = useDigitalMarketingPaidAdsFilters();
  const [accountId, setAccountId] = useState('');

  const accounts = useMemo(() => settingsQuery.data?.accounts ?? [], [settingsQuery.data?.accounts]);

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].account_id);
    }
  }, [accounts, accountId]);

  const datePayload = useMemo(
    () => threadsContentMetricsFetchArgs(dateSelection),
    [dateSelection],
  );

  const metricsQuery = useThreadsContentMetricsQuery({
    organizationId,
    accountId,
    dateStart: datePayload.dateStart,
    dateEnd: datePayload.dateEnd,
    allTime: datePayload.allTime,
    enabled: Boolean(organizationId && accountId && settingsQuery.data?.oauthConnected),
  });

  const calendarYearPresetYears = useMemo(() => buildThreadsCalendarYearPresetYears(), []);
  const metricsLoading = metricsQuery.isLoading || metricsQuery.isFetching;

  if (gatePending || settingsQuery.isPending || instagramAccountsLoading) {
    return null;
  }

  const notConnected = !settingsQuery.data?.oauthConnected;
  const hasInstagramConnected = instagramAccounts.length > 0;

  return (
    <div className="grid min-h-[calc(100vh-120px)] w-full min-w-0 flex-1 grid-cols-12 gap-2 items-stretch [grid-template-rows:minmax(0,1fr)] lg:max-h-[calc(100vh-120px)] lg:overflow-hidden">
            <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {notConnected ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <p className="mb-4 max-w-md text-sm text-slate-600">
                    {hasInstagramConnected
                      ? t(
                          'digitalMarketing.threadsContent.threadsOAuthRequiredDesc',
                          'Instagram is connected. Threads uses a separate authorization — open Connect Threads and complete the Threads login (not Instagram reconnect).',
                        )
                      : t(
                          'digitalMarketing.threadsContent.instagramRequiredDesc',
                          'Connect an Instagram Business account first, then authorize Threads on the Connect Threads page.',
                        )}
                  </p>
                  <Button asChild>
                    <Link to={hasInstagramConnected ? CONNECT_THREADS_PATH : CONNECT_INSTAGRAM_PATH}>
                      {hasInstagramConnected
                        ? t('threadsConnect.connectButton', 'Connect Threads')
                        : t('digitalMarketing.threadsContent.openInstagramConnect', 'Connect Instagram')}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
                  <ThreadsContentAccountNav
                    organizationId={organizationId}
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
                        <ThreadsDateRangePicker
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
    </div>
  );
}
