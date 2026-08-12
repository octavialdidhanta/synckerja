import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { endOfDay } from "date-fns";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { DigitalMarketingMobileFooter } from "@/mobile/6-0-digital-marketing/components/DigitalMarketingMobileFooter";
import { TikTokAdsMobileShellHeader } from "@/mobile/6-0-tiktok-ads/components/TikTokAdsMobileShellHeader";
import { MobileTikTokAdsSummaryBar } from "@/mobile/6-0-tiktok-ads/components/MobileTikTokAdsSummaryBar";
import { MobileTikTokAdsFilterStrip } from "@/mobile/6-0-tiktok-ads/components/MobileTikTokAdsFilterStrip";
import { MobileTikTokAdsMetricsTable } from "@/mobile/6-0-tiktok-ads/components/MobileTikTokAdsMetricsTable";
import { CustomDatePicker } from "@/mobile-app/components/CustomDatePicker";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";
import { ToolsMobileDenyGateArea } from "@/mobile-app/components/ToolsMobileDenyGateArea";
import { useMobileToolsShellLayout } from "@/shared/hooks/useMobileToolsShellLayout";
import { useToolsMobilePageAccess } from "@/mobile-app/hooks/useToolsMobilePageAccess";
import { cn } from "@/shared/lib/utils";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { parseYmdLocal, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import {
  buildTikTokAdsCalendarYearPresetYears,
  tiktokAdsAllTimeDateRange,
} from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { toTikTokAdsMetricsDateRangePayload } from "@/tiktok-ads/lib/toTikTokAdsMetricsDateRangePayload";
import { useOmnichannelSurveySettingsAdmin } from "@/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useTikTokAdsReportingEnabled } from "@/tiktok-ads/hooks/useTikTokAdsReportingEnabled";
import { useTikTokAdsSettings } from "@/tiktok-ads/hooks/useTikTokAdsSettings";
import {
  fetchTikTokAdsMetrics,
  useTikTokAdsMetricsQuery,
  type TikTokAdsMetricEntity,
} from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import { useTikTokAdsColumnSets } from "@/tiktok-ads/hooks/useTikTokAdsColumnSets";
import { useTikTokAdsMetricsPreferences } from "@/tiktok-ads/hooks/useTikTokAdsMetricsPreferences";
import {
  getTikTokAdsCatalogMetricKeys,
  getTikTokAdsMetricsForEntity,
  resolveTikTokAdsMetricItems,
} from "@/tiktok-ads/metrics/tiktokAdsMetricCatalog";
import {
  filterTikTokAdsPreferenceMetricKeys,
  findMatchingTikTokAdsColumnSet,
} from "@/tiktok-ads/metrics/tiktokAdsColumnSetMatch";
import {
  TIKTOK_ADS_SUMMARY_DEFAULT_SLOT_KEYS,
  tiktokAdsSummaryValidKeys,
  normalizeTikTokAdsSummarySlotKeys,
  type TikTokAdsTableMetricKey,
} from "@/tiktok-ads/metrics/tiktokAdsSummaryMetrics";
import {
  loadTikTokAdsSummarySlotMetrics,
  saveTikTokAdsSummarySlotMetrics,
} from "@/tiktok-ads/metrics/tiktokAdsSummaryMetricStorage";
import {
  buildTikTokAdsSortColumnOptions,
  defaultTikTokAdsSortDirection,
  getTikTokAdsSortColumnKind,
  resolveSortForOptions,
  type TikTokAdsMetricsSort,
} from "@/tiktok-ads/metrics/tiktokAdsSortColumns";
import { sortTikTokAdsRows } from "@/tiktok-ads/metrics/sortTikTokAdsRows";
import { TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH } from "@/tiktok-ads/settings/tiktokAdsSettingsPaths";
import { toast } from "sonner";

function MobileTikTokAdsPageContent({ hasPageAccess }: { hasPageAccess: boolean }) {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useTikTokAdsReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useTikTokAdsSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });
  const oauthConnected = settings?.oauthConnected ?? false;

  const {
    dateSelection,
    setDateSelection,
    tiktokAdvertiserId,
    setTikTokAdvertiserId,
    filtersHydrated,
  } = useDigitalMarketingPaidAdsFilters();
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [entity, setEntity] = useState<TikTokAdsMetricEntity>("campaign");
  const [summarySlotMetricKeys, setSummarySlotMetricKeys] = useState<TikTokAdsTableMetricKey[]>(
    () => [...TIKTOK_ADS_SUMMARY_DEFAULT_SLOT_KEYS],
  );
  const [sort, setSort] = useState<TikTokAdsMetricsSort>({ field: "spend", direction: "desc" });
  const sortHydratedForEntityRef = useRef<string | null>(null);

  const advertiserId = tiktokAdvertiserId;

  /** All time on TikTok = 365 days. */
  useEffect(() => {
    if (dateSelection.preset !== "all_time") return;
    const { start, end } = tiktokAdsAllTimeDateRange();
    const from = parseYmdLocal(start);
    const to = parseYmdLocal(end);
    if (!from || !to) return;
    const nextTo = endOfDay(to);
    const curFrom = dateSelection.range.from ? toYmdLocal(dateSelection.range.from) : "";
    const curTo = dateSelection.range.to ? toYmdLocal(dateSelection.range.to) : "";
    if (curFrom === start && curTo === toYmdLocal(nextTo)) return;
    setDateSelection((prev) => ({
      ...prev,
      preset: "all_time",
      range: { from, to: nextTo },
    }));
  }, [dateSelection.preset, dateSelection.range.from, dateSelection.range.to, setDateSelection]);

  const calendarYearPresetYears = useMemo(() => buildTikTokAdsCalendarYearPresetYears(), []);

  const dateRange = useMemo(
    () => toTikTokAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );
  const dateStart = dateRange.start;
  const dateEnd = dateRange.end;

  const activeAccounts = useMemo(
    () => (oauthConnected ? (settings?.accounts ?? []).filter((a) => a.is_active) : []),
    [settings?.accounts, oauthConnected],
  );

  useEffect(() => {
    if (!oauthConnected && tiktokAdvertiserId) {
      setTikTokAdvertiserId("");
    }
  }, [oauthConnected, tiktokAdvertiserId, setTikTokAdvertiserId]);

  const filterAccounts = useMemo(
    () =>
      activeAccounts.map((a) => ({
        id: a.id,
        label: a.label,
        advertiser_id: a.advertiser_id,
      })),
    [activeAccounts],
  );

  useEffect(() => {
    if (!advertiserId && activeAccounts.length > 0) {
      const def = activeAccounts.find((a) => a.is_default) ?? activeAccounts[0];
      setTikTokAdvertiserId(def.advertiser_id);
    }
  }, [activeAccounts, advertiserId, setTikTokAdvertiserId]);

  const validMetricKeys = useMemo(() => getTikTokAdsCatalogMetricKeys(), []);
  const catalogItems = useMemo(() => getTikTokAdsMetricsForEntity(entity), [entity]);

  const { columnSets } = useTikTokAdsColumnSets(organizationId, entity, true);

  const {
    visibleColumns: selectedMetrics,
    storedSort,
    isPending: prefsPending,
    save: saveMetrics,
    saveSort,
  } = useTikTokAdsMetricsPreferences(organizationId, entity, validMetricKeys);

  const metricItems = useMemo(
    () => resolveTikTokAdsMetricItems(selectedMetrics, entity),
    [selectedMetrics, entity],
  );

  const matchedColumnSet = useMemo(
    () => findMatchingTikTokAdsColumnSet(columnSets, selectedMetrics),
    [columnSets, selectedMetrics],
  );

  useEffect(() => {
    setSummarySlotMetricKeys(
      normalizeTikTokAdsSummarySlotKeys(
        loadTikTokAdsSummarySlotMetrics(entity),
        tiktokAdsSummaryValidKeys(entity),
        entity,
      ),
    );
  }, [entity]);

  const handleSummaryKeysChange = useCallback(
    (keys: TikTokAdsTableMetricKey[]) => {
      setSummarySlotMetricKeys(keys);
      saveTikTokAdsSummarySlotMetrics(entity, keys);
    },
    [entity],
  );

  const sortColumnOptions = useMemo(
    () => buildTikTokAdsSortColumnOptions(entity, selectedMetrics),
    [entity, selectedMetrics],
  );

  useEffect(() => {
    sortHydratedForEntityRef.current = null;
  }, [entity, organizationId]);

  useEffect(() => {
    if (prefsPending || sortColumnOptions.length === 0) return;
    if (sortHydratedForEntityRef.current === entity) return;
    sortHydratedForEntityRef.current = entity;
    setSort(resolveSortForOptions(storedSort, sortColumnOptions));
  }, [prefsPending, storedSort, sortColumnOptions, entity]);

  useEffect(() => {
    if (sortColumnOptions.length === 0) return;
    setSort((current) => {
      const next = resolveSortForOptions(current, sortColumnOptions);
      if (next.field === current.field && next.direction === current.direction) return current;
      return next;
    });
  }, [sortColumnOptions]);

  const accountReadyForMetrics =
    Boolean(advertiserId) &&
    activeAccounts.some((a) => a.advertiser_id === advertiserId);

  const metricsQuery = useTikTokAdsMetricsQuery({
    organizationId,
    advertiserId,
    entity,
    dateStart,
    dateEnd,
    enabled:
      reportingEnabled &&
      accountReadyForMetrics &&
      canManage &&
      !gatePending,
  });

  const sortFieldValue = useMemo(() => {
    if (sortColumnOptions.some((o) => o.key === sort.field)) return sort.field;
    return sortColumnOptions[0]?.key ?? "spend";
  }, [sort.field, sortColumnOptions]);

  const sortedRows = useMemo(() => {
    const rows = metricsQuery.data?.rows ?? [];
    return sortTikTokAdsRows(rows, { field: sortFieldValue, direction: sort.direction }, entity);
  }, [metricsQuery.data?.rows, sortFieldValue, sort.direction, entity]);

  const handleSortFieldChange = useCallback(
    (field: string) => {
      const kind = getTikTokAdsSortColumnKind(field);
      const next: TikTokAdsMetricsSort = {
        field,
        direction: defaultTikTokAdsSortDirection(kind),
      };
      setSort(next);
      void saveSort.mutateAsync(next);
    },
    [saveSort],
  );

  const handleSortDirectionChange = useCallback(
    (direction: "asc" | "desc") => {
      const next: TikTokAdsMetricsSort = { field: sortFieldValue, direction };
      setSort(next);
      void saveSort.mutateAsync(next);
    },
    [sortFieldValue, saveSort],
  );

  const handleApplyMetrics = useCallback(
    async (keys: string[]) => {
      try {
        const itemsAfterApply = resolveTikTokAdsMetricItems(keys, entity);
        const optionsAfterApply = buildTikTokAdsSortColumnOptions(
          entity,
          itemsAfterApply.map((m) => m.key),
        );
        const nextSort = resolveSortForOptions(sort, optionsAfterApply);
        setSort(nextSort);
        await saveMetrics.mutateAsync({ visibleColumns: keys, sort: nextSort });
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [entity, sort, saveMetrics],
  );

  const handleSwitchColumnSet = useCallback(
    async (setId: string) => {
      if (matchedColumnSet?.id === setId) return;
      const set = columnSets.find((s) => s.id === setId);
      if (!set) return;
      const keys = filterTikTokAdsPreferenceMetricKeys(set.metric_keys, validMetricKeys);
      if (keys.length === 0) {
        toast.error(
          t(
            "digitalMarketing.tiktokAds.columnSetEmpty",
            "This column set has no available columns for this view.",
          ),
        );
        return;
      }
      await handleApplyMetrics(keys);
    },
    [matchedColumnSet?.id, columnSets, validMetricKeys, handleApplyMetrics, t],
  );

  const handleCustomDateRange = useCallback(
    (startDate: Date, endDate: Date) => {
      setCustomDateRange({ start: startDate, end: endDate });
      setDateSelection({
        preset: "custom",
        range: { from: startDate, to: endDate },
        rollingDays: 30,
      });
    },
    [setDateSelection],
  );

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !advertiserId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const fresh = await fetchTikTokAdsMetrics({
        organizationId,
        advertiserId,
        entity,
        dateStart,
        dateEnd,
        forceRefresh: true,
      });
      queryClient.setQueryData(
        ["tiktok-ads-metrics", organizationId, advertiserId, entity, dateStart, dateEnd, ""],
        fresh,
      );
    } catch (e) {
      toast.error((e as Error).message);
      await metricsQuery.refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [
    organizationId,
    advertiserId,
    entity,
    dateStart,
    dateEnd,
    isRefreshing,
    queryClient,
    metricsQuery,
  ]);

  const showContentGate = !gatePending && canManage;
  const accountsNavPending = settingsPending;
  const summaryLoading =
    reportingPending ||
    accountsNavPending ||
    prefsPending ||
    (accountReadyForMetrics && reportingEnabled && metricsQuery.isPending);
  const tableLoading =
    prefsPending ||
    (accountReadyForMetrics &&
      reportingEnabled &&
      (metricsQuery.isPending || metricsQuery.isFetching));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/70">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex flex-col bg-muted/70" style={mainFixedStyle}>
          <TikTokAdsMobileShellHeader
            onRefresh={
              showContentGate && oauthConnected && accountReadyForMetrics
                ? () => void handleRefresh()
                : undefined
            }
            refreshDisabled={isRefreshing || metricsQuery.isFetching}
            isRefreshing={isRefreshing || metricsQuery.isFetching}
          />

          <ModuleShellContentGate
            pagePath={MOBILE_PAGE_PATH.digitalMarketingTikTokAds}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {hasPageAccess ? (
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="mx-auto w-full max-w-md space-y-2 px-2 pt-2 content-padding-above-nav-default">
                  {!canManage && !gatePending ? (
                    <Alert>
                      <AlertTitle>
                        {t(
                          "digitalMarketing.tiktokAds.accessDeniedTitle",
                          "Access restricted",
                        )}
                      </AlertTitle>
                      <AlertDescription>
                        {t(
                          "digitalMarketing.tiktokAds.accessDeniedBody",
                          "Only the organization owner or an omnichannel admin can view TikTok Ads metrics.",
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {canManage && !oauthConnected && !settingsPending ? (
                    <Alert>
                      <AlertTitle>
                        {t("digitalMarketing.tiktokAds.notConnected", "TikTok Ads not connected")}
                      </AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>
                          {t(
                            "digitalMarketing.tiktokAds.notConnectedHint",
                            "Connect TikTok Ads in settings to view metrics.",
                          )}
                        </p>
                        <Button asChild variant="outline" size="sm">
                          <Link to={TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH}>
                            {t(
                              "digitalMarketing.tiktokAds.settingsLink",
                              "TikTok Ads settings",
                            )}
                          </Link>
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {canManage &&
                  oauthConnected &&
                  activeAccounts.length === 0 &&
                  !settingsPending ? (
                    <Alert>
                      <AlertTitle>
                        {t(
                          "digitalMarketing.tiktokAds.noAccountsTitle",
                          "No ad accounts ready",
                        )}
                      </AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>
                          {t(
                            "digitalMarketing.tiktokAds.noAccountsHint",
                            "Sync advertiser accounts in Settings for reporting.",
                          )}
                        </p>
                        <Button asChild variant="outline" size="sm">
                          <Link to={TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH}>
                            {t(
                              "digitalMarketing.tiktokAds.settingsLink",
                              "TikTok Ads settings",
                            )}
                          </Link>
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {canManage && oauthConnected && activeAccounts.length > 0 ? (
                    <>
                      {reportingEnabled && accountReadyForMetrics ? (
                        <MobileTikTokAdsSummaryBar
                          entity={entity}
                          advertiserId={advertiserId}
                          summary={metricsQuery.data?.summary}
                          rows={sortedRows}
                          catalogItems={catalogItems}
                          metricKeys={summarySlotMetricKeys}
                          onMetricKeysChange={handleSummaryKeysChange}
                          isLoading={summaryLoading}
                        />
                      ) : null}

                      <MobileTikTokAdsFilterStrip
                        accounts={filterAccounts}
                        advertiserId={advertiserId}
                        onAdvertiserIdChange={setTikTokAdvertiserId}
                        accountsLoading={accountsNavPending}
                        dateSelection={dateSelection}
                        onDateSelectionChange={setDateSelection}
                        filtersHydrated={filtersHydrated}
                        calendarYearPresetYears={calendarYearPresetYears}
                        allTimeHint={t(
                          "digitalMarketing.tiktokAds.dateRangeClampedHint",
                          "TikTok Ads limits history to the last 365 days.",
                        )}
                        onCustomDateClick={() => setShowCustomDatePicker(true)}
                        entity={entity}
                        onEntityChange={setEntity}
                        showEntity={reportingEnabled && accountReadyForMetrics}
                        columnSets={columnSets}
                        activeColumnSetId={matchedColumnSet?.id}
                        onColumnSetSelect={(id) => void handleSwitchColumnSet(id)}
                        columnSetDisabled={saveMetrics.isPending}
                        columnSetLoading={prefsPending}
                        showColumnSet={reportingEnabled && accountReadyForMetrics}
                        sort={sort}
                        sortColumnOptions={sortColumnOptions}
                        onSortFieldChange={handleSortFieldChange}
                        onSortDirectionChange={handleSortDirectionChange}
                        showSort={reportingEnabled && accountReadyForMetrics}
                      />

                      {reportingEnabled && accountReadyForMetrics ? (
                        <MobileTikTokAdsMetricsTable
                          entity={entity}
                          rows={sortedRows}
                          metricItems={metricItems}
                          currencyCode={metricsQuery.data?.summary?.currency ?? null}
                          isLoading={tableLoading && !metricsQuery.data}
                        />
                      ) : null}

                      {metricsQuery.isError ? (
                        <Alert>
                          <AlertTitle>{t("common.error", "Error")}</AlertTitle>
                          <AlertDescription>
                            {metricsQuery.error instanceof Error
                              ? metricsQuery.error.message
                              : String(metricsQuery.error)}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </ModuleShellContentGate>

          {!isKeyboardShellOpen ? (
            <DigitalMarketingMobileFooter className="safe-area-bottom-lower" />
          ) : null}
        </main>
      </div>

      <CustomDatePicker
        isOpen={showCustomDatePicker}
        onClose={() => setShowCustomDatePicker(false)}
        onDateRangeSelect={handleCustomDateRange}
        initialStartDate={customDateRange?.start ?? dateSelection.range.from ?? undefined}
        initialEndDate={customDateRange?.end ?? dateSelection.range.to ?? undefined}
      />
    </SidebarProvider>
  );
}

export default function MobileTikTokAdsPage() {
  useStatusBarStyle("light");
  const { isKeyboardShellOpen } = useVisualViewport();
  const { outerShellClassName, mainShellClassName, mainShellStyle } = useMobileToolsShellLayout();
  const pagePath = MOBILE_PAGE_PATH.digitalMarketingTikTokAds;
  const { hasPageAccess, showDenyShellHeader } = useToolsMobilePageAccess(pagePath);

  if (showDenyShellHeader) {
    return (
      <SidebarProvider>
        <div className={cn(outerShellClassName, "bg-muted/70")}>
          <AppSidebar />
          <main
            className={cn(
              "z-0 flex w-full min-w-0 max-w-none flex-col bg-muted/70",
              mainShellClassName,
            )}
            style={mainShellStyle}
          >
            <TikTokAdsMobileShellHeader />
            <ToolsMobileDenyGateArea
              pagePath={pagePath}
              contentPaddingClass="content-padding-above-nav-default"
            />
            {!isKeyboardShellOpen ? (
              <DigitalMarketingMobileFooter className="safe-area-bottom-lower" />
            ) : null}
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return <MobileTikTokAdsPageContent hasPageAccess={hasPageAccess} />;
}
