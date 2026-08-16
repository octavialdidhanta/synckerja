import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { CustomDatePicker } from "@/mobile-app/components/CustomDatePicker";
import { MobileSocialMediaPerformancePageFrame } from "@/mobile/6-0-social-media-performance/components/MobileSocialMediaPerformancePageFrame";
import { MobileSmpFilterStrip } from "@/mobile/6-0-social-media-performance/components/MobileSmpFilterStrip";
import { MobileManageCommentsAccountButton } from "@/mobile/6-0-social-media-performance/components/MobileManageCommentsAccountButton";
import { useSmpManualRefresh } from "@/mobile/6-0-social-media-performance/shared/useSmpManualRefresh";
import { MobileSmpSummaryGrid } from "@/mobile/6-0-social-media-performance/components/MobileSmpSummaryGrid";
import { MobileSmpMetricsTable } from "@/mobile/6-0-social-media-performance/components/MobileSmpMetricsTable";
import { formatSmpCount, formatSmpPercent } from "@/mobile/6-0-social-media-performance/shared/formatSmpMetrics";
import {
  formatSmpPostedAt,
  smpContentPerformanceColumns,
} from "@/mobile/6-0-social-media-performance/shared/smpPerformanceTableColumns";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useThreadsContentSettings } from "@/threads-content/hooks/useThreadsContentSettings";
import {
  fetchThreadsContentMetrics,
  useThreadsContentMetricsQuery,
} from "@/threads-content/hooks/useThreadsContentMetrics";
import {
  CONNECT_INSTAGRAM_PATH,
  CONNECT_THREADS_PATH,
} from "@/threads-content/settings/threadsContentSettingsPaths";
import { useInstagramAccounts } from "@/5-3-whatsapp/hooks/useInstagramAccounts";
import {
  buildThreadsCalendarYearPresetYears,
  threadsContentMetricsFetchArgs,
} from "@/threads-content/lib/toThreadsPostDateRangePayload";

export default function MobileThreadsContentPerformancePage() {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { isRefreshing: manualRefreshing, runRefresh } = useSmpManualRefresh();
  const { organizationId, gatePending } = useOmnichannelSurveySettingsAdmin();
  const settingsQuery = useThreadsContentSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });
  const { accounts: instagramAccounts, isLoading: instagramAccountsLoading } = useInstagramAccounts();
  const { dateSelection, setDateSelection, filtersHydrated } = useDigitalMarketingPaidAdsFilters();
  const [accountId, setAccountId] = useState("");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

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

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !accountId) return;
    await runRefresh(async () => {
      try {
        const fresh = await fetchThreadsContentMetrics({
          organizationId,
          accountId,
          dateStart: datePayload.dateStart,
          dateEnd: datePayload.dateEnd,
          allTime: datePayload.allTime,
        });
        queryClient.setQueryData(
          [
            "threads-content-metrics",
            organizationId,
            accountId,
            datePayload.dateStart,
            datePayload.dateEnd,
            datePayload.allTime,
          ],
          fresh,
        );
      } catch (e) {
        toast.error((e as Error).message);
        await metricsQuery.refetch();
      }
    });
  }, [organizationId, accountId, datePayload, queryClient, metricsQuery, runRefresh]);

  const calendarYearPresetYears = useMemo(() => buildThreadsCalendarYearPresetYears(), []);
  const metricsLoading = metricsQuery.isLoading || (metricsQuery.isFetching && !metricsQuery.data);
  const notConnected = !settingsQuery.data?.oauthConnected;
  const hasInstagramConnected = instagramAccounts.length > 0;
  const account = metricsQuery.data?.account;

  const cards = [
    {
      key: "audience",
      label: t("digitalMarketing.socialMediaInsightReport.colAudience", "Audience"),
      value: formatSmpCount(account?.audience_count),
    },
    {
      key: "posts",
      label: t("digitalMarketing.threadsContent.summaryPosts", "Posts"),
      value: formatSmpCount(account?.content_count ?? 0),
    },
    {
      key: "views",
      label: t("digitalMarketing.tiktokContent.summaryViews", "Views"),
      value: formatSmpCount(account?.total_views ?? 0),
    },
    {
      key: "likes",
      label: t("digitalMarketing.tiktokContent.summaryLikes", "Likes"),
      value: formatSmpCount(account?.total_likes ?? 0),
    },
    {
      key: "comments",
      label: t("digitalMarketing.tiktokContent.summaryComments", "Comments"),
      value: formatSmpCount(account?.total_comments ?? 0),
    },
    {
      key: "engagement",
      label: t("digitalMarketing.tiktokContent.summaryEngagement", "Engagement"),
      value: formatSmpPercent(account?.avg_engagement_rate ?? null),
    },
  ];

  const tableColumns = smpContentPerformanceColumns(
    t,
    t("digitalMarketing.threadsContent.colPost", "Post"),
  );
  const tableRows = (metricsQuery.data?.posts ?? []).map((row) => ({
    id: row.content_id,
    cells: {
      name: row.caption?.trim() || row.content_id,
      views: formatSmpCount(row.view_count),
      likes: formatSmpCount(row.like_count),
      comments: formatSmpCount(row.comment_count),
      shares: formatSmpCount(row.share_count),
      engagement: formatSmpPercent(row.engagement_rate),
      posted: formatSmpPostedAt(row.posted_at),
    },
  }));

  return (
    <MobileSocialMediaPerformancePageFrame
      onRefresh={() => void handleRefresh()}
      refreshDisabled={!accountId || manualRefreshing || notConnected}
      isRefreshing={manualRefreshing}
      headerActions={
        notConnected ? undefined : (
          <MobileManageCommentsAccountButton
            accounts={accounts.map((a) => ({
              value: a.account_id,
              label: a.account_label || a.account_id,
            }))}
            accountId={accountId}
            onAccountIdChange={setAccountId}
            accountsLoading={settingsQuery.isPending}
          />
        )
      }
    >
      {gatePending || settingsQuery.isPending || instagramAccountsLoading ? null : notConnected ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            {hasInstagramConnected
              ? t(
                  "digitalMarketing.threadsContent.threadsOAuthRequiredDesc",
                  "Instagram is connected. Threads uses a separate authorization — open Connect Threads and complete the Threads login (not Instagram reconnect).",
                )
              : t(
                  "digitalMarketing.threadsContent.instagramRequiredDesc",
                  "Connect an Instagram Business account first, then authorize Threads on the Connect Threads page.",
                )}
          </p>
          <Button asChild>
            <Link to={hasInstagramConnected ? CONNECT_THREADS_PATH : CONNECT_INSTAGRAM_PATH}>
              {hasInstagramConnected
                ? t("threadsConnect.connectButton", "Connect Threads")
                : t("digitalMarketing.threadsContent.openInstagramConnect", "Connect Instagram")}
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <MobileSmpFilterStrip
            accounts={accounts.map((a) => ({
              value: a.account_id,
              label: a.account_label || a.account_id,
            }))}
            accountId={accountId}
            onAccountIdChange={setAccountId}
            accountsLoading={settingsQuery.isPending}
            showAccount={false}
            dateSelection={dateSelection}
            onDateSelectionChange={setDateSelection}
            filtersHydrated={filtersHydrated}
            calendarYearPresetYears={calendarYearPresetYears}
            onCustomDateClick={() => setShowCustomDatePicker(true)}
          />
          <MobileSmpSummaryGrid cards={cards} isLoading={metricsLoading} />
          {metricsQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>
                {t("digitalMarketing.threadsContent.error", "Failed to load posts")}
              </AlertTitle>
              <AlertDescription>{(metricsQuery.error as Error)?.message}</AlertDescription>
            </Alert>
          ) : (
            <MobileSmpMetricsTable
              columns={tableColumns}
              rows={tableRows}
              isLoading={metricsLoading}
              itemLabel={t("digitalMarketing.threadsContent.summaryPosts", "posts")}
              emptyText={t(
                "digitalMarketing.threadsContent.noPosts",
                "No posts in this date range.",
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
