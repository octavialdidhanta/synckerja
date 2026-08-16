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
import { MetaAdsMobileShellHeader } from "@/mobile/6-0-meta-ads/components/MetaAdsMobileShellHeader";
import { MobileMetaAdsSummaryBar } from "@/mobile/6-0-meta-ads/components/MobileMetaAdsSummaryBar";
import { MobileMetaAdsFilterStrip } from "@/mobile/6-0-meta-ads/components/MobileMetaAdsFilterStrip";
import { MobileMetaAdsMetricsTable } from "@/mobile/6-0-meta-ads/components/MobileMetaAdsMetricsTable";
import { MobileManageCommentsAccountButton } from "@/mobile/6-0-social-media-performance/components/MobileManageCommentsAccountButton";
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
  buildMetaAdsCalendarYearPresetYears,
  metaAdsAllTimeDateRange,
} from "@/meta-ads/lib/clampMetaAdsDateRange";
import { toMetaAdsMetricsDateRangePayload } from "@/meta-ads/lib/toMetaAdsMetricsDateRangePayload";
import { useOmnichannelSurveySettingsAdmin } from "@/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useMetaAdsReportingEnabled } from "@/meta-ads/hooks/useMetaAdsReportingEnabled";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import {
  fetchMetaAdsMetrics,
  useMetaAdsMetricsQuery,
  type MetaAdsMetricEntity,
} from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { useMetaAdsColumnSets } from "@/meta-ads/hooks/useMetaAdsColumnSets";
import { useMetaAdsMetricsPreferences } from "@/meta-ads/hooks/useMetaAdsMetricsPreferences";
import {
  getMetaAdsCatalogMetricKeys,
  getMetaAdsMetricsForEntity,
  resolveMetaAdsMetricItems,
} from "@/meta-ads/metrics/metaAdsMetricCatalog";
import {
  filterMetaAdsPreferenceMetricKeys,
  findMatchingMetaAdsColumnSet,
} from "@/meta-ads/metrics/metaAdsColumnSetMatch";
import {
  META_ADS_SUMMARY_DEFAULT_SLOT_KEYS,
  metaAdsSummaryValidKeys,
  normalizeMetaAdsSummarySlotKeys,
  type MetaAdsTableMetricKey,
} from "@/meta-ads/metrics/metaAdsSummaryMetrics";
import {
  loadMetaAdsSummarySlotMetrics,
  saveMetaAdsSummarySlotMetrics,
} from "@/meta-ads/metrics/metaAdsSummaryMetricStorage";
import {
  buildMetaAdsSortColumnOptions,
  defaultMetaAdsSortDirection,
  getMetaAdsSortColumnKind,
  resolveSortForOptions,
  type MetaAdsMetricsSort,
} from "@/meta-ads/metrics/metaAdsSortColumns";
import { sortMetaAdsRows } from "@/meta-ads/metrics/sortMetaAdsRows";
import { META_ADS_DIGITAL_MARKETING_SETTINGS_PATH } from "@/meta-ads/settings/metaAdsSettingsPaths";
import { toast } from "sonner";

function MobileMetaAdsPageContent({ hasPageAccess }: { hasPageAccess: boolean }) {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useMetaAdsReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useMetaAdsSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });
  const oauthConnected = settings?.oauthConnected ?? false;

  const {
    dateSelection,
    setDateSelection,
    metaAdAccountId,
    setMetaAdAccountId,
    filtersHydrated,
  } = useDigitalMarketingPaidAdsFilters();
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [entity, setEntity] = useState<MetaAdsMetricEntity>("campaign");
  const [summarySlotMetricKeys, setSummarySlotMetricKeys] = useState<MetaAdsTableMetricKey[]>(
    () => [...META_ADS_SUMMARY_DEFAULT_SLOT_KEYS],
  );
  const [sort, setSort] = useState<MetaAdsMetricsSort>({ field: "spend", direction: "desc" });
  const sortHydratedForEntityRef = useRef<string | null>(null);

  const adAccountId = metaAdAccountId;

  /** All time on Meta = 37 months (not Google account earliest). */
  useEffect(() => {
    if (dateSelection.preset !== "all_time") return;
    const { start, end } = metaAdsAllTimeDateRange();
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

  const calendarYearPresetYears = useMemo(() => buildMetaAdsCalendarYearPresetYears(), []);

  const dateRange = useMemo(
    () => toMetaAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );
  const dateStart = dateRange.start;
  const dateEnd = dateRange.end;

  const allActiveAccounts = useMemo(
    () => (oauthConnected ? (settings?.accounts ?? []).filter((a) => a.is_active) : []),
    [settings?.accounts, oauthConnected],
  );

  useEffect(() => {
    if (!oauthConnected && metaAdAccountId) {
      setMetaAdAccountId("");
    }
  }, [oauthConnected, metaAdAccountId, setMetaAdAccountId]);

  const metricsReadyAccounts = useMemo(
    () => allActiveAccounts.filter((a) => a.pixel_id !== "0"),
    [allActiveAccounts],
  );

  const filterAccounts = useMemo(
    () =>
      allActiveAccounts.map((a) => ({
        id: a.id,
        label: a.label,
        ad_account_id: a.ad_account_id,
        metricsReady: a.pixel_id !== "0",
      })),
    [allActiveAccounts],
  );

  useEffect(() => {
    if (!adAccountId && metricsReadyAccounts.length > 0) {
      const def = metricsReadyAccounts.find((a) => a.is_default) ?? metricsReadyAccounts[0];
      setMetaAdAccountId(def.ad_account_id);
    }
  }, [metricsReadyAccounts, adAccountId, setMetaAdAccountId]);

  const validMetricKeys = useMemo(() => getMetaAdsCatalogMetricKeys(), []);
  const catalogItems = useMemo(() => getMetaAdsMetricsForEntity(entity), [entity]);

  const { columnSets } = useMetaAdsColumnSets(organizationId, entity, true);

  const {
    visibleColumns: selectedMetrics,
    storedSort,
    isPending: prefsPending,
    save: saveMetrics,
    saveSort,
  } = useMetaAdsMetricsPreferences(organizationId, entity, validMetricKeys);

  const metricItems = useMemo(
    () => resolveMetaAdsMetricItems(selectedMetrics, entity),
    [selectedMetrics, entity],
  );

  const matchedColumnSet = useMemo(
    () => findMatchingMetaAdsColumnSet(columnSets, selectedMetrics),
    [columnSets, selectedMetrics],
  );

  useEffect(() => {
    setSummarySlotMetricKeys(
      normalizeMetaAdsSummarySlotKeys(
        loadMetaAdsSummarySlotMetrics(entity),
        metaAdsSummaryValidKeys(entity),
        entity,
      ),
    );
  }, [entity]);

  const handleSummaryKeysChange = useCallback(
    (keys: MetaAdsTableMetricKey[]) => {
      setSummarySlotMetricKeys(keys);
      saveMetaAdsSummarySlotMetrics(entity, keys);
    },
    [entity],
  );

  const sortColumnOptions = useMemo(
    () => buildMetaAdsSortColumnOptions(entity, selectedMetrics),
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
    Boolean(adAccountId) &&
    metricsReadyAccounts.some((a) => a.ad_account_id === adAccountId);

  const metricsQuery = useMetaAdsMetricsQuery({
    organizationId,
    adAccountId,
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
    return sortMetaAdsRows(rows, { field: sortFieldValue, direction: sort.direction }, entity);
  }, [metricsQuery.data?.rows, sortFieldValue, sort.direction, entity]);

  const handleSortFieldChange = useCallback(
    (field: string) => {
      const kind = getMetaAdsSortColumnKind(field);
      const next: MetaAdsMetricsSort = {
        field,
        direction: defaultMetaAdsSortDirection(kind),
      };
      setSort(next);
      void saveSort.mutateAsync(next);
    },
    [saveSort],
  );

  const handleSortDirectionChange = useCallback(
    (direction: "asc" | "desc") => {
      const next: MetaAdsMetricsSort = { field: sortFieldValue, direction };
      setSort(next);
      void saveSort.mutateAsync(next);
    },
    [sortFieldValue, saveSort],
  );

  const handleApplyMetrics = useCallback(
    async (keys: string[]) => {
      try {
        const itemsAfterApply = resolveMetaAdsMetricItems(keys, entity);
        const optionsAfterApply = buildMetaAdsSortColumnOptions(
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
      const keys = filterMetaAdsPreferenceMetricKeys(set.metric_keys, validMetricKeys);
      if (keys.length === 0) {
        toast.error(
          t(
            "digitalMarketing.metaAds.columnSetEmpty",
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
    if (!organizationId || !adAccountId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const fresh = await fetchMetaAdsMetrics({
        organizationId,
        adAccountId,
        entity,
        dateStart,
        dateEnd,
        forceRefresh: true,
      });
      queryClient.setQueryData(
        ["meta-ads-metrics", organizationId, adAccountId, entity, dateStart, dateEnd, ""],
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
    adAccountId,
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

  const hasAccountsButNoPixel =
    oauthConnected && allActiveAccounts.length > 0 && metricsReadyAccounts.length === 0;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/70">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex flex-col bg-muted/70" style={mainFixedStyle}>
          <MetaAdsMobileShellHeader
            onRefresh={
              showContentGate && oauthConnected && accountReadyForMetrics
                ? () => void handleRefresh()
                : undefined
            }
            refreshDisabled={isRefreshing || metricsQuery.isFetching}
            isRefreshing={isRefreshing || metricsQuery.isFetching}
            headerActions={
              showContentGate && oauthConnected ? (
                <MobileManageCommentsAccountButton
                  accounts={filterAccounts.map((a) => ({
                    value: a.ad_account_id,
                    label: a.label?.trim() || a.ad_account_id,
                    hint: a.metricsReady
                      ? undefined
                      : t(
                          "digitalMarketing.metaAds.navPixelRequiredAccount",
                          "Edit this account and enter your Meta Pixel ID from Events Manager.",
                        ),
                  }))}
                  accountId={adAccountId}
                  onAccountIdChange={setMetaAdAccountId}
                  accountsLoading={accountsNavPending}
                />
              ) : undefined
            }
          />

          <ModuleShellContentGate
            pagePath={MOBILE_PAGE_PATH.digitalMarketingMetaAds}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {hasPageAccess ? (
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="mx-auto min-w-0 w-full max-w-md space-y-2 px-2 pt-2 content-padding-above-nav-default">
                  {!canManage && !gatePending ? (
                    <Alert>
                      <AlertTitle>
                        {t(
                          "digitalMarketing.metaAds.accessDeniedTitle",
                          "Access restricted",
                        )}
                      </AlertTitle>
                      <AlertDescription>
                        {t(
                          "digitalMarketing.metaAds.accessDeniedBody",
                          "Only the organization owner or an omnichannel admin can view Meta Ads metrics.",
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {canManage && !oauthConnected && !settingsPending ? (
                    <Alert>
                      <AlertTitle>
                        {t("digitalMarketing.metaAds.notConnected", "Meta Ads not connected")}
                      </AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>
                          {t(
                            "digitalMarketing.metaAds.notConnectedHint",
                            "Connect Meta Ads in Offline Conversion settings to view metrics.",
                          )}
                        </p>
                        <Button asChild variant="outline" size="sm">
                          <Link to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}>
                            {t(
                              "digitalMarketing.metaAds.settingsLink",
                              "Meta Ads settings",
                            )}
                          </Link>
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {canManage && oauthConnected && hasAccountsButNoPixel ? (
                    <Alert>
                      <AlertTitle>
                        {t(
                          "digitalMarketing.metaAds.pixelRequiredTitle",
                          "Pixel ID required",
                        )}
                      </AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>
                          {t(
                            "digitalMarketing.metaAds.pixelRequiredHint",
                            "Your ad accounts are synced but still use Pixel 0. Open Settings, click Edit on each account, and paste the Pixel ID from Meta Events Manager.",
                          )}
                        </p>
                        <Button asChild variant="outline" size="sm">
                          <Link to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}>
                            {t(
                              "digitalMarketing.metaAds.settingsLink",
                              "Meta Ads settings",
                            )}
                          </Link>
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {canManage &&
                  oauthConnected &&
                  !hasAccountsButNoPixel &&
                  allActiveAccounts.length === 0 &&
                  !settingsPending ? (
                    <Alert>
                      <AlertTitle>
                        {t(
                          "digitalMarketing.metaAds.noAccountsTitle",
                          "No ad accounts ready",
                        )}
                      </AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>
                          {t(
                            "digitalMarketing.metaAds.noAccountsHint",
                            "Sync ad accounts in Settings and set a Pixel ID for each account you want to report on.",
                          )}
                        </p>
                        <Button asChild variant="outline" size="sm">
                          <Link to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}>
                            {t(
                              "digitalMarketing.metaAds.settingsLink",
                              "Meta Ads settings",
                            )}
                          </Link>
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {canManage && oauthConnected && allActiveAccounts.length > 0 ? (
                    <>
                      {reportingEnabled && accountReadyForMetrics ? (
                        <MobileMetaAdsSummaryBar
                          entity={entity}
                          adAccountId={adAccountId}
                          summary={metricsQuery.data?.summary}
                          rows={sortedRows}
                          catalogItems={catalogItems}
                          metricKeys={summarySlotMetricKeys}
                          onMetricKeysChange={handleSummaryKeysChange}
                          isLoading={summaryLoading}
                          organizationId={organizationId}
                          dateStart={dateStart}
                          dateEnd={dateEnd}
                          compareEnabled={
                            reportingEnabled &&
                            accountReadyForMetrics &&
                            canManage &&
                            !gatePending
                          }
                        />
                      ) : null}

                      <MobileMetaAdsFilterStrip
                        accounts={filterAccounts}
                        adAccountId={adAccountId}
                        onAdAccountIdChange={setMetaAdAccountId}
                        accountsLoading={accountsNavPending}
                        showAccount={false}
                        dateSelection={dateSelection}
                        onDateSelectionChange={setDateSelection}
                        filtersHydrated={filtersHydrated}
                        calendarYearPresetYears={calendarYearPresetYears}
                        allTimeHint={t(
                          "digitalMarketing.metaAds.dateRangeClampedHint",
                          "Meta Ads limits history to the last 37 months.",
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
                        <MobileMetaAdsMetricsTable
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

export default function MobileMetaAdsPage() {
  useStatusBarStyle("light");
  const { isKeyboardShellOpen } = useVisualViewport();
  const { outerShellClassName, mainShellClassName, mainShellStyle } = useMobileToolsShellLayout();
  const pagePath = MOBILE_PAGE_PATH.digitalMarketingMetaAds;
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
            <MetaAdsMobileShellHeader />
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

  return <MobileMetaAdsPageContent hasPageAccess={hasPageAccess} />;
}
