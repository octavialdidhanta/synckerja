import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Instagram, Facebook, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { SocialMediaPerformanceModuleShell } from '@/6-0-social-media-performance/layout/SocialMediaPerformanceModuleShell';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { cn } from '@/shared/lib/utils';
import { useOmnichannelSurveySettingsAdmin } from '@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin';
import { useDigitalMarketingPaidAdsFilters } from '@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext';
import { MetaContentPerformanceAccountNav } from '@/6-0-social-media-performance/components/MetaContentPerformanceAccountNav';
import { MetaContentSummaryBar } from '@/6-0-social-media-performance/components/MetaContentSummaryBar';
import { MetaContentPostsTable } from '@/6-0-social-media-performance/components/MetaContentPostsTable';
import { MetaContentPerformancePanelSkeleton } from '@/6-0-social-media-performance/skeletons/MetaContentPerformancePageSkeleton';
import { useMetaContentTargetProgress } from '@/6-0-social-media-performance-shared/hooks/useMetaContentTargetProgress';
import { useMetaContentConfig } from '@/meta-content/hooks/useMetaContentConfig';
import {
  fetchMetaContentMetrics,
  useMetaContentMetricsQuery,
} from '@/meta-content/hooks/useMetaContentMetrics';
import { MetaContentSettingsPanel } from '@/meta-content/settings/MetaContentSettingsPanel';
import {
  getMetaContentBasePath,
  getMetaContentSettingsPath,
} from '@/meta-content/settings/metaContentSettingsPaths';
import { missingScopesForFeature } from '@/meta-platform/constants/metaOAuthScopes';
import type { MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { MetaContentDateRangePicker } from '@/6-0-meta-ads/components/MetaContentDateRangePicker';
import { buildMetaContentCalendarYearPresetYears } from '@/meta-content/lib/clampMetaContentDateRange';
import { toMetaPostDateRangePayload, metaContentMetricsFetchArgs } from '@/meta-content/lib/toMetaContentMetricsDateRangePayload';

const SOCIAL_MEDIA_PERFORMANCE_PATH = '/digital-marketing/social-media-performance';

type MetaContentPerformancePageProps = {
  platform: MetaContentPlatform;
};

export function MetaContentPerformancePage({ platform }: MetaContentPerformancePageProps) {
  return (
    <SocialMediaPerformanceModuleShell>
      <MetaContentPerformancePageContent platform={platform} />
    </SocialMediaPerformanceModuleShell>
  );
}

function MetaContentPerformancePageContent({ platform }: { platform: MetaContentPlatform }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const settingsPath = getMetaContentSettingsPath(platform);
  const basePath = getMetaContentBasePath(platform);
  const isSettingsView = location.pathname === settingsPath;
  const { organizationId, gatePending } = useOmnichannelSurveySettingsAdmin();
  const configQuery = useMetaContentConfig(organizationId);
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(null);
  const PlatformIcon = platform === 'instagram' ? Instagram : Facebook;

  const { dateSelection, setDateSelection } = useDigitalMarketingPaidAdsFilters();

  const calendarYearPresetYears = useMemo(() => buildMetaContentCalendarYearPresetYears(), []);

  const postDateFilter = useMemo(
    () => toMetaPostDateRangePayload(dateSelection),
    [dateSelection],
  );
  const metricsFetchArgs = useMemo(
    () => metaContentMetricsFetchArgs(dateSelection),
    [dateSelection],
  );
  const { dateStart, dateEnd, allTime } = metricsFetchArgs;

  const platformAccounts = useMemo(
    () => (configQuery.data?.accounts ?? []).filter((a) => a.platform === platform),
    [configQuery.data?.accounts, platform],
  );

  const defaultAccountId = useMemo(() => {
    if (platformAccounts.length === 0) return '';
    return platformAccounts[0].account_id;
  }, [platformAccounts]);

  const accountId =
    accountIdOverride && platformAccounts.some((a) => a.account_id === accountIdOverride)
      ? accountIdOverride
      : defaultAccountId;

  const selectedAccount = useMemo(
    () => platformAccounts.find((a) => a.account_id === accountId) ?? null,
    [platformAccounts, accountId],
  );

  const insightsScopesGranted = useMemo(() => {
    if (!selectedAccount) return false;
    return missingScopesForFeature(selectedAccount.granted_scopes ?? [], 'insights').length === 0;
  }, [selectedAccount]);

  const showMetricsView =
    !isSettingsView &&
    Boolean(accountId) &&
    platformAccounts.some((a) => a.account_id === accountId) &&
    insightsScopesGranted;

  const metricsQuery = useMetaContentMetricsQuery({
    organizationId,
    platform,
    accountId,
    dateStart,
    dateEnd,
    allTime,
    enabled: Boolean(organizationId && accountId && !gatePending && showMetricsView),
  });

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !accountId) return;
    const rangeKeyStart = allTime ? 'all_time' : (dateStart ?? 'all_time');
    const rangeKeyEnd = allTime ? 'all_time' : (dateEnd ?? 'all_time');
    const queryKey = [
      'meta-content-metrics',
      'v17',
      organizationId,
      platform,
      accountId,
      rangeKeyStart,
      rangeKeyEnd,
    ] as const;
    try {
      await queryClient.invalidateQueries({ queryKey });
      const fresh = await fetchMetaContentMetrics({
        organizationId,
        platform,
        accountId,
        dateStart,
        dateEnd,
        allTime,
      });
      queryClient.setQueryData(queryKey, fresh);
    } catch (e) {
      toast.error((e as Error).message);
      await metricsQuery.refetch();
    }
  }, [organizationId, accountId, platform, dateStart, dateEnd, allTime, queryClient, metricsQuery]);

  const { progressList, targetsLoading } = useMetaContentTargetProgress({
    platform,
    accountId,
    account: metricsQuery.data?.account,
    accountLabel: selectedAccount?.account_label ?? null,
    avatarUrl: selectedAccount?.avatar_url ?? null,
    enabled: showMetricsView,
  });

  const showEmptyRange =
    !postDateFilter.isAllTime &&
    metricsQuery.data != null &&
    (metricsQuery.data.posts?.length ?? 0) === 0;

  const showEmptyAllTime =
    postDateFilter.isAllTime &&
    metricsQuery.data != null &&
    (metricsQuery.data.posts?.length ?? 0) === 0 &&
    !metricsQuery.isFetching;

  const showFacebookMetricsEmpty = useMemo(() => {
    if (platform !== 'facebook' || !metricsQuery.data?.posts?.length) return false;
    return metricsQuery.data.posts.every(
      (p) =>
        p.like_count === 0 &&
        p.comment_count === 0 &&
        p.view_count === 0 &&
        p.reach === 0,
    );
  }, [platform, metricsQuery.data?.posts]);

  const metricsLoading =
    metricsQuery.isLoading || (metricsQuery.isFetching && !metricsQuery.data);

  const showConnectCta = !configQuery.isLoading && platformAccounts.length === 0;

  const dataPending =
    orgBootstrapPending ||
    gatePending ||
    configQuery.isLoading ||
    (showMetricsView && metricsQuery.isLoading);

  const { showFullPageSkeleton, accessReady } = useModulePageOverlaySkeleton(
    dataPending,
    SOCIAL_MEDIA_PERFORMANCE_PATH,
  );
  const showContent = useDebouncedReady(accessReady && !showFullPageSkeleton, 150);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          !showContent && 'pointer-events-none invisible',
        )}
        aria-hidden={!showContent}
      >
                <div className="grid min-h-0 min-w-0 w-full flex-1 basis-0 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
                      <MetaContentPerformanceAccountNav
                        platform={platform}
                        accounts={configQuery.data?.accounts ?? []}
                        accountId={accountId}
                        onAccountIdChange={(next) => {
                          setAccountIdOverride(next);
                          if (isSettingsView) {
                            navigate(basePath);
                          }
                        }}
                        settingsActive={isSettingsView}
                        onSettingsSelect={() => navigate(settingsPath)}
                      />

                      <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                        {isSettingsView ? (
                          <MetaContentSettingsPanel
                            platform={platform}
                            oauthReturnPath={settingsPath}
                            className="min-h-0 flex-1"
                          />
                        ) : (
                          <>
                            <div className="shrink-0 space-y-3 border-b border-gray-200 p-4 [@media(max-height:900px)]:space-y-2 [@media(max-height:900px)]:p-3">
                              {showConnectCta ? (
                                <Alert>
                                  <AlertTitle>
                                    {t('metaPlatform.performance.connectFirst', 'Connect Meta to view organic insights.')}
                                  </AlertTitle>
                                  <AlertDescription>
                                    <Link
                                      to={settingsPath}
                                      className="font-medium text-primary underline"
                                    >
                                      {t('digitalMarketing.metaContent.openSettings', 'Open settings')}
                                    </Link>
                                  </AlertDescription>
                                </Alert>
                              ) : selectedAccount && !insightsScopesGranted ? (
                                <Alert variant="destructive">
                                  <AlertTitle>
                                    {t('metaPlatform.insights.scopeMissingTitle', 'Insights permission required')}
                                  </AlertTitle>
                                  <AlertDescription>
                                    {t(
                                      'metaPlatform.insights.scopeMissingHint',
                                      'Reconnect to grant instagram_manage_insights or pages_read_engagement.',
                                    )}{' '}
                                    <Link to={settingsPath} className="underline">
                                      {t('metaPlatform.insights.openConnect', 'Reconnect')}
                                    </Link>
                                  </AlertDescription>
                                </Alert>
                              ) : showEmptyRange ? (
                                <Alert>
                                  <AlertTitle>
                                    {t(
                                      'digitalMarketing.metaContent.emptyRangeTitle',
                                      'No posts in selected range',
                                    )}
                                  </AlertTitle>
                                  <AlertDescription>
                                    {platform === 'instagram'
                                      ? t(
                                          'digitalMarketing.metaContent.instagramEmptyRangeHint',
                                          'No Instagram media was published between the selected start and end dates. Try a wider range or another preset.',
                                        )
                                      : t(
                                          'digitalMarketing.metaContent.facebookEmptyRangeHint',
                                          'No Facebook posts were published between the selected start and end dates. Try a wider range or another preset.',
                                        )}
                                  </AlertDescription>
                                </Alert>
                              ) : showEmptyAllTime ? (
                                <Alert>
                                  <AlertTitle>
                                    {t(
                                      'digitalMarketing.metaContent.emptyAllTimeTitle',
                                      'No posts found',
                                    )}
                                  </AlertTitle>
                                  <AlertDescription>
                                    {platform === 'facebook'
                                      ? t(
                                          'digitalMarketing.metaContent.facebookEmptyAllTimeHint',
                                          'Meta returned no page posts. Reconnect Facebook in Settings and grant pages_read_engagement, then refresh.',
                                        )
                                      : t(
                                          'digitalMarketing.metaContent.instagramEmptyAllTimeHint',
                                          'Meta returned no media for this account. Check the connection in Settings, then refresh.',
                                        )}{' '}
                                    <Link to={settingsPath} className="underline">
                                      {t('metaPlatform.insights.openConnect', 'Reconnect')}
                                    </Link>
                                  </AlertDescription>
                                </Alert>
                              ) : showFacebookMetricsEmpty ? (
                                <Alert>
                                  <AlertTitle>
                                    {t('metaPlatform.insights.scopeMissingTitle', 'Insights permission required')}
                                  </AlertTitle>
                                  <AlertDescription>
                                    {t(
                                      'digitalMarketing.metaContent.facebookMetricsEmptyHint',
                                      'Post metrics are all zero. Reconnect Facebook in Settings and grant pages_read_engagement so Synckerja can read reactions and insights.',
                                    )}{' '}
                                    <Link to={settingsPath} className="underline">
                                      {t('metaPlatform.insights.openConnect', 'Reconnect')}
                                    </Link>
                                  </AlertDescription>
                                </Alert>
                              ) : null}

                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  aria-label={t('common.refresh', 'Refresh')}
                                  disabled={!showMetricsView || metricsQuery.isFetching}
                                  onClick={() => void handleRefresh()}
                                >
                                  {metricsQuery.isFetching ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                                <MetaContentDateRangePicker
                                  value={dateSelection}
                                  onChange={setDateSelection}
                                  calendarYearPresetYears={calendarYearPresetYears}
                                />
                              </div>

                              <p className="text-right text-[11px] text-muted-foreground">
                                {postDateFilter.isAllTime
                                  ? t(
                                      'digitalMarketing.metaContent.metaAllTimeHint',
                                      'All time paginates through all published posts. Per-post metrics are lifetime totals from Meta.',
                                    )
                                  : t(
                                      'digitalMarketing.metaContent.metaDateHint',
                                      'Summary and table show posts published in the selected date range. Per-post metrics are lifetime totals from Meta.',
                                    )}
                              </p>
                            </div>

                            {showConnectCta ? (
                              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                                <PlatformIcon className="mb-4 h-12 w-12 text-slate-300" />
                                <p className="mb-4 text-sm text-slate-600">
                                  {t(
                                    'metaPlatform.performance.connectFirst',
                                    'Connect Meta to view organic insights.',
                                  )}
                                </p>
                                <Button asChild>
                                  <Link to={settingsPath}>
                                    {t('metaPlatform.performance.openConnect', 'Connect')}
                                  </Link>
                                </Button>
                              </div>
                            ) : (
                              <>
                                <MetaContentSummaryBar
                                  account={metricsQuery.data?.account}
                                  posts={metricsQuery.data?.posts ?? []}
                                  targetProgress={progressList}
                                  isLoading={metricsLoading}
                                  targetsLoading={targetsLoading}
                                />

                                <div className="min-h-0 flex-1 overflow-hidden">
                                  {metricsQuery.isError ? (
                                    <div className="p-4">
                                      <Alert variant="destructive">
                                        <AlertTitle>{t('common.error', 'Error')}</AlertTitle>
                                        <AlertDescription>
                                          {(metricsQuery.error as Error)?.message}
                                        </AlertDescription>
                                      </Alert>
                                    </div>
                                  ) : (
                                    <MetaContentPostsTable rows={metricsQuery.data?.posts ?? []} />
                                  )}
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
      </div>

      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100"
          aria-busy="true"
        >
          <MetaContentPerformancePanelSkeleton />
        </div>
      ) : null}
    </div>
  );
}
