import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
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
import { useSmpAllTimeDateClamp } from "@/mobile/6-0-social-media-performance/shared/useSmpAllTimeDateClamp";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useLinkedInContentReportingEnabled } from "@/linkedin-content/hooks/useLinkedInContentReportingEnabled";
import { useLinkedInContentSettings } from "@/linkedin-content/hooks/useLinkedInContentSettings";
import {
  fetchLinkedInContentPosts,
  useLinkedInContentPostsQuery,
} from "@/linkedin-content/hooks/useLinkedInContentPostsQuery";
import { LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH } from "@/linkedin-content/settings/linkedinContentSettingsPaths";
import { buildTikTokAdsCalendarYearPresetYears } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { toTikTokAdsMetricsDateRangePayload } from "@/tiktok-ads/lib/toTikTokAdsMetricsDateRangePayload";

export default function MobileLinkedInContentPerformancePage() {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { isRefreshing: manualRefreshing, runRefresh } = useSmpManualRefresh();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useLinkedInContentReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useLinkedInContentSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });
  const { dateSelection, setDateSelection, filtersHydrated } = useDigitalMarketingPaidAdsFilters();
  const [pageId, setPageId] = useState("");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  useSmpAllTimeDateClamp(dateSelection, setDateSelection);

  const calendarYearPresetYears = useMemo(() => buildTikTokAdsCalendarYearPresetYears(), []);
  const dateRange = useMemo(
    () => toTikTokAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );
  const dateStart = dateRange.start;
  const dateEnd = dateRange.end;

  const activeAccounts = useMemo(
    () => (settings?.accounts ?? []).filter((a) => a.is_active),
    [settings?.accounts],
  );

  useEffect(() => {
    if (!pageId && activeAccounts.length > 0) {
      const def = activeAccounts.find((a) => a.is_default) ?? activeAccounts[0];
      setPageId(def.page_id);
    }
  }, [activeAccounts, pageId]);

  const postsQuery = useLinkedInContentPostsQuery({
    organizationId,
    pageId,
    dateStart,
    dateEnd,
    enabled:
      reportingEnabled &&
      Boolean(pageId) &&
      activeAccounts.some((a) => a.page_id === pageId) &&
      canManage,
  });

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !pageId) return;
    await runRefresh(async () => {
      try {
        const fresh = await fetchLinkedInContentPosts({
          organizationId,
          pageId,
          dateStart,
          dateEnd,
          forceRefresh: true,
        });
        queryClient.setQueryData(
          ["linkedin-content-posts", organizationId, pageId, dateStart, dateEnd],
          fresh,
        );
      } catch (e) {
        toast.error((e as Error).message);
        await postsQuery.refetch();
      }
    });
  }, [organizationId, pageId, dateStart, dateEnd, queryClient, postsQuery, runRefresh]);

  const summary = postsQuery.data?.summary;
  const metricsLoading = postsQuery.isLoading || (postsQuery.isFetching && !postsQuery.data);

  const cards = [
    {
      key: "audience",
      label: t("digitalMarketing.socialMediaInsightReport.colAudience", "Audience"),
      value: formatSmpCount(postsQuery.data?.audience_count),
    },
    {
      key: "posts",
      label: t("digitalMarketing.linkedinContent.summaryPosts", "Posts"),
      value: formatSmpCount(summary?.post_count ?? 0),
    },
    {
      key: "views",
      label: t("digitalMarketing.tiktokContent.summaryViews", "Views"),
      value: formatSmpCount(summary?.total_views ?? 0),
    },
    {
      key: "likes",
      label: t("digitalMarketing.tiktokContent.summaryLikes", "Likes"),
      value: formatSmpCount(summary?.total_likes ?? 0),
    },
    {
      key: "comments",
      label: t("digitalMarketing.tiktokContent.summaryComments", "Comments"),
      value: formatSmpCount(summary?.total_comments ?? 0),
    },
    {
      key: "engagement",
      label: t("digitalMarketing.tiktokContent.summaryEngagement", "Engagement"),
      value: formatSmpPercent(summary?.avg_engagement_rate ?? null),
    },
  ];

  const tableColumns = smpContentPerformanceColumns(
    t,
    t("digitalMarketing.linkedinContent.colPost", "Post"),
  );
  const tableRows = (postsQuery.data?.rows ?? []).map((row) => ({
    id: row.post_id,
    cells: {
      name: row.title || row.post_id,
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
      refreshDisabled={!reportingEnabled || !pageId || manualRefreshing}
      isRefreshing={manualRefreshing}
      headerActions={
        canManage ? (
          <MobileManageCommentsAccountButton
            accounts={activeAccounts.map((a) => ({
              value: a.page_id,
              label: a.label?.trim() || a.display_name?.trim() || a.page_id,
            }))}
            accountId={pageId}
            onAccountIdChange={setPageId}
            accountsLoading={settingsPending}
          />
        ) : undefined
      }
    >
      {!canManage && !gatePending ? (
        <Alert>
          <AlertTitle>
            {t("digitalMarketing.linkedinContent.accessDeniedTitle", "Access restricted")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.linkedinContent.accessDeniedBody",
              "Only the organization owner or an omnichannel admin can view LinkedIn content insights.",
            )}
          </AlertDescription>
        </Alert>
      ) : !reportingPending && !reportingEnabled ? (
        <Alert>
          <AlertTitle>
            {t("digitalMarketing.linkedinContent.notConnected", "LinkedIn not connected")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.linkedinContent.notConnectedDesc",
              "Connect a LinkedIn page in settings to view post insights.",
            )}{" "}
            <Link
              to={LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH}
              className="font-medium text-primary underline"
            >
              {t("digitalMarketing.linkedinContent.openSettings", "Open settings")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <MobileSmpFilterStrip
            accounts={activeAccounts.map((a) => ({
              value: a.page_id,
              label: a.label?.trim() || a.display_name?.trim() || a.page_id,
            }))}
            accountId={pageId}
            onAccountIdChange={setPageId}
            accountsLoading={settingsPending}
            showAccount={false}
            dateSelection={dateSelection}
            onDateSelectionChange={setDateSelection}
            filtersHydrated={filtersHydrated}
            calendarYearPresetYears={calendarYearPresetYears}
            onCustomDateClick={() => setShowCustomDatePicker(true)}
          />
          <MobileSmpSummaryGrid cards={cards} isLoading={metricsLoading} />
          {postsQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>
                {t("digitalMarketing.linkedinContent.error", "Failed to load posts")}
              </AlertTitle>
              <AlertDescription>{(postsQuery.error as Error)?.message}</AlertDescription>
            </Alert>
          ) : (
            <MobileSmpMetricsTable
              columns={tableColumns}
              rows={tableRows}
              isLoading={metricsLoading}
              itemLabel={t("digitalMarketing.linkedinContent.summaryPosts", "posts")}
              totalCount={summary?.post_count ?? tableRows.length}
              emptyText={t(
                "digitalMarketing.linkedinContent.noPosts",
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
