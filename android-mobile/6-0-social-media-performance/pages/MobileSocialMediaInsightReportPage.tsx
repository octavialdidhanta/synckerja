import { useCallback, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { CustomDatePicker } from "@/mobile-app/components/CustomDatePicker";
import { MobileSocialMediaPerformancePageFrame } from "@/mobile/6-0-social-media-performance/components/MobileSocialMediaPerformancePageFrame";
import { MobileSmpFilterStrip } from "@/mobile/6-0-social-media-performance/components/MobileSmpFilterStrip";
import { MobileSmpSummaryGrid } from "@/mobile/6-0-social-media-performance/components/MobileSmpSummaryGrid";
import { MobileSmpMetricsTable } from "@/mobile/6-0-social-media-performance/components/MobileSmpMetricsTable";
import { formatSmpCount, formatSmpPercent } from "@/mobile/6-0-social-media-performance/shared/formatSmpMetrics";
import {
  smpInsightPlatformLabel,
  smpInsightReportColumns,
} from "@/mobile/6-0-social-media-performance/shared/smpPerformanceTableColumns";
import { useSmpAllTimeDateClamp } from "@/mobile/6-0-social-media-performance/shared/useSmpAllTimeDateClamp";
import { useSmpManualRefresh } from "@/mobile/6-0-social-media-performance/shared/useSmpManualRefresh";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useSocialMediaInsightReportData } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightReportData";
import { useSocialMediaInsightTargetProgress } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetProgress";
import {
  insightReportPeriodCompareBits,
  insightReportSummaryForFilter,
  useSocialMediaInsightReportPeriodCompare,
  type InsightReportCompareCardKey,
} from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightReportPeriodCompare";
import { SocialMediaInsightAccountAvatar } from "@/6-0-social-media-report/components/SocialMediaInsightAccountAvatar";
import { MobileSmpPlatformIcon } from "@/mobile/6-0-social-media-performance/shared/MobileSmpPlatformIcon";
import { buildTikTokAdsCalendarYearPresetYears } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";

export default function MobileSocialMediaInsightReportPage() {
  const { t } = useAppTranslation();
  const { isRefreshing: manualRefreshing, runRefresh } = useSmpManualRefresh();
  const { canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { dateSelection, setDateSelection, filtersHydrated } = useDigitalMarketingPaidAdsFilters();
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  useSmpAllTimeDateClamp(dateSelection, setDateSelection);

  const report = useSocialMediaInsightReportData({
    enabled: canManage && !gatePending,
    chartsEnabled: false,
  });
  const calendarYearPresetYears = useMemo(() => buildTikTokAdsCalendarYearPresetYears(), []);
  const { progressList, targetsLoading } = useSocialMediaInsightTargetProgress({
    summary: report.summary,
    accounts: report.accounts,
    platformFilter: "all",
  });

  const { previousRange, previousAccounts, compareLoading, compareError } =
    useSocialMediaInsightReportPeriodCompare({
      dateStart: report.dateStart,
      dateEnd: report.dateEnd,
      enabled: canManage && !gatePending,
    });
  const previousSummary = insightReportSummaryForFilter(previousAccounts, "all");
  const metricsLoading = report.pageLoading;

  const compareFor = (cardKey: InsightReportCompareCardKey) =>
    insightReportPeriodCompareBits({
      cardKey,
      currentSummary: report.summary,
      previousSummary,
      previousRange,
      compareLoading: compareLoading || metricsLoading,
      compareError,
    });

  const handleRefresh = useCallback(async () => {
    await runRefresh(async () => {
      report.triggerForceRefresh();
      await report.refetch();
    });
  }, [report.triggerForceRefresh, report.refetch, runRefresh]);

  const cards = [
    {
      key: "audience",
      metric: "audience" as const,
      label: t("digitalMarketing.socialMediaInsightReport.summaryAudience", "Audience"),
      value: formatSmpCount(report.summary.totalAudience),
      audienceHint: true,
    },
    {
      key: "views",
      metric: "views" as const,
      label: t("digitalMarketing.socialMediaInsightReport.summaryViews", "Views"),
      value: formatSmpCount(report.summary.totalViews),
      ...compareFor("views"),
    },
    {
      key: "likes",
      metric: "likes" as const,
      label: t("digitalMarketing.socialMediaInsightReport.summaryLikes", "Likes"),
      value: formatSmpCount(report.summary.totalLikes),
      ...compareFor("likes"),
    },
    {
      key: "comments",
      metric: "comments" as const,
      label: t("digitalMarketing.socialMediaInsightReport.summaryComments", "Comments"),
      value: formatSmpCount(report.summary.totalComments),
      ...compareFor("comments"),
    },
    {
      key: "shares",
      metric: "shares" as const,
      label: t("digitalMarketing.socialMediaInsightReport.summaryShares", "Shares"),
      value: formatSmpCount(report.summary.totalShares),
      ...compareFor("shares"),
    },
    {
      key: "engagement",
      metric: "avg_engagement_rate" as const,
      label: t("digitalMarketing.socialMediaInsightReport.summaryEngagement", "Avg. engagement"),
      value: formatSmpPercent(report.summary.avgEngagementRate),
      ...compareFor("avg_engagement_rate"),
    },
  ];

  const tableColumns = smpInsightReportColumns(t);
  const tableRows = report.accounts.map((row) => {
    const connected = row.connected && !row.isPlatformPlaceholder;
    const accountLabel = row.isPlatformPlaceholder
      ? smpInsightPlatformLabel(row.platform, t)
      : row.accountLabel || row.accountId;
    const audience = !connected
      ? "—"
      : row.audienceHidden
        ? t("digitalMarketing.youtubeContent.subscriberCountHidden", "Hidden")
        : row.audienceCount == null
          ? "—"
          : row.audienceLabel === "followers"
            ? `${formatSmpCount(row.audienceCount)} ${t("digitalMarketing.socialMediaInsightReport.followersShort", "followers")}`
            : row.audienceLabel === "subscribers"
              ? `${formatSmpCount(row.audienceCount)} ${t("digitalMarketing.socialMediaInsightReport.subscribersShort", "subscribers")}`
              : formatSmpCount(row.audienceCount);
    const status = row.error
      ? row.error
      : !row.connected
        ? t("digitalMarketing.socialMediaInsightReport.statusNotConnected", "Not connected")
        : t("digitalMarketing.socialMediaInsightReport.statusConnected", "Connected");
    const action = !row.connected
      ? t("digitalMarketing.socialMediaInsightReport.openSettings", "Settings")
      : row.isPlatformPlaceholder
        ? "—"
        : t("digitalMarketing.socialMediaInsightReport.viewPerformance", "View");

    return {
      id: row.isPlatformPlaceholder ? `placeholder-${row.platform}` : `${row.platform}-${row.accountId}`,
      cells: {
        platform: (
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <MobileSmpPlatformIcon platform={row.platform} />
            {smpInsightPlatformLabel(row.platform, t)}
          </span>
        ),
        account: (
          <span className="inline-flex max-w-[12rem] min-w-0 items-center gap-2">
            <SocialMediaInsightAccountAvatar
              avatarUrl={row.avatarUrl}
              accountLabel={accountLabel}
              organizationId={report.organizationId}
              platform={row.platform}
              accountId={row.accountId}
            />
            <span className="truncate font-medium text-foreground">{accountLabel}</span>
          </span>
        ),
        audience,
        content: connected ? formatSmpCount(row.contentCount) : "—",
        views: connected ? formatSmpCount(row.totalViews) : "—",
        likes: connected ? formatSmpCount(row.totalLikes) : "—",
        comments: connected ? formatSmpCount(row.totalComments) : "—",
        shares: connected ? formatSmpCount(row.totalShares) : "—",
        engagement: connected ? formatSmpPercent(row.avgEngagementRate) : "—",
        planMatched: connected ? `${row.matchedPlans}/${row.totalContent}` : "—",
        status,
        action,
      },
    };
  });

  return (
    <MobileSocialMediaPerformancePageFrame
      onRefresh={() => void handleRefresh()}
      refreshDisabled={!canManage || manualRefreshing}
      isRefreshing={manualRefreshing}
    >
      {!canManage && !gatePending ? (
        <Alert>
          <AlertTitle>
            {t("digitalMarketing.tiktokContent.accessDeniedTitle", "Access restricted")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.tiktokContent.accessDeniedBody",
              "Only organization owners or omnichannel admins can view organic social content insights.",
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <MobileSmpFilterStrip
            accounts={[]}
            accountId=""
            onAccountIdChange={() => undefined}
            showAccount={false}
            dateSelection={dateSelection}
            onDateSelectionChange={setDateSelection}
            filtersHydrated={filtersHydrated}
            calendarYearPresetYears={calendarYearPresetYears}
            onCustomDateClick={() => setShowCustomDatePicker(true)}
          />
          <MobileSmpSummaryGrid
            cards={cards}
            isLoading={report.pageLoading}
            targetsLoading={targetsLoading}
            targetProgress={progressList}
          />
          {report.error ? (
            <Alert variant="destructive">
              <AlertTitle>
                {t("digitalMarketing.socialMediaInsightReport.error", "Failed to load report")}
              </AlertTitle>
              <AlertDescription>{(report.error as Error)?.message}</AlertDescription>
            </Alert>
          ) : (
            <MobileSmpMetricsTable
              columns={tableColumns}
              rows={tableRows}
              isLoading={report.pageLoading}
              itemLabel={t("digitalMarketing.socialMediaInsightReport.colAccount", "accounts")}
              emptyText={t(
                "digitalMarketing.socialMediaInsightReport.noAccounts",
                "No connected accounts in this date range.",
              )}
            />
          )}
        </>
      )}

      <CustomDatePicker
        isOpen={showCustomDatePicker}
        onClose={() => setShowCustomDatePicker(false)}
        onDateRangeSelect={(start, end) => {
          setDateSelection((prev) => ({
            ...prev,
            preset: "custom",
            range: { from: start, to: end },
          }));
          setShowCustomDatePicker(false);
        }}
        initialStartDate={dateSelection.range.from ?? undefined}
        initialEndDate={dateSelection.range.to ?? undefined}
      />
    </MobileSocialMediaPerformancePageFrame>
  );
}
