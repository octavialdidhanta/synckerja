import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { DigitalMarketingMobileFooter } from "@/mobile/6-0-digital-marketing/components/DigitalMarketingMobileFooter";
import { GoogleAdsMobileShellHeader } from "@/mobile/6-0-google-ads/components/GoogleAdsMobileShellHeader";
import { MobileGoogleAdsSummaryBar } from "@/mobile/6-0-google-ads/components/MobileGoogleAdsSummaryBar";
import { MobileGoogleAdsFilterStrip } from "@/mobile/6-0-google-ads/components/MobileGoogleAdsFilterStrip";
import { MobileGoogleAdsMetricsTable } from "@/mobile/6-0-google-ads/components/MobileGoogleAdsMetricsTable";
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
import { buildReportYearOptionsFromEarliest } from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";
import {
  computePresetRange,
  toGoogleAdsMetricsDateRangePayload,
  toYmdLocal,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
import { useOmnichannelSurveySettingsAdmin } from "@/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useGoogleAdsReportingEnabled } from "@/google-ads/hooks/useGoogleAdsReportingEnabled";
import { useGoogleAdsSettings } from "@/google-ads/hooks/useGoogleAdsSettings";
import { useGoogleAdsConversionActions } from "@/google-ads/hooks/useGoogleAdsConversionActions";
import { useGoogleAdsMetricCatalog } from "@/google-ads/hooks/useGoogleAdsMetricCatalog";
import { useGoogleAdsColumnSets } from "@/google-ads/hooks/useGoogleAdsColumnSets";
import { useGoogleAdsCampaignList } from "@/google-ads/hooks/useGoogleAdsCampaignList";
import { useGoogleAdsMetricsPreferences } from "@/google-ads/hooks/useGoogleAdsMetricsPreferences";
import { useGoogleAdsUiCustomColumns } from "@/google-ads/hooks/useGoogleAdsUiCustomColumns";
import { useGoogleAdsDeliveryEnabledFilters } from "@/6-0-google-ads/hooks/useGoogleAdsDeliveryEnabledFilters";
import {
  buildGoogleAdsMetricsQueryKey,
  fetchGoogleAdsMetricsFresh,
  useGoogleAdsMetricsQuery,
} from "@/google-ads/hooks/useGoogleAdsMetricsQuery";
import { useGoogleAdsSummarySlotMetrics } from "@/google-ads/hooks/useGoogleAdsSummarySlotMetrics";
import { buildSummaryMetricOptions } from "@/google-ads/metrics/googleAdsSummaryMetricOptions";
import {
  filterGoogleAdsPreferenceMetricKeys,
  findMatchingGoogleAdsColumnSet,
} from "@/google-ads/metrics/googleAdsColumnSetMatch";
import {
  GOOGLE_ADS_OPTIONAL_IDENTITY_COLUMNS,
  isOptionalIdentityColumnKey,
  stripGoogleAdsPinnedMetricKeys,
} from "@/google-ads/metrics/googleAdsIdentityColumns";
import {
  buildSortColumnOptions,
  defaultSortDirectionForKind,
  getSortColumnKind,
  parseStoredSort,
  resolveSortForOptions,
} from "@/google-ads/metrics/googleAdsSortColumns";
import { GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH } from "@/google-ads/settings/googleAdsSettingsPaths";
import { supabase } from "@/shared/lib/supabaseClient";
import type { GoogleAdsMetricEntity, GoogleAdsMetricsSort } from "@/google-ads/metrics/types";
import { toast } from "sonner";

const MOBILE_PAGE_SIZE = 25;
const EMPTY_CONVERSION_ACTIONS: Array<{ key: string; label: string }> = [];

function MobileGoogleAdsPageContent({ hasPageAccess }: { hasPageAccess: boolean }) {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useGoogleAdsReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useGoogleAdsSettings(organizationId, {
    enabled: canManage && !gatePending,
  });
  const oauthConnected = settings?.oauthConnected ?? false;

  const {
    dateSelection,
    setDateSelection,
    googleCustomerId,
    setGoogleCustomerId,
    filtersHydrated,
  } = useDigitalMarketingPaidAdsFilters();
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [entity, setEntity] = useState<GoogleAdsMetricEntity>("campaign");
  const [sort, setSort] = useState<GoogleAdsMetricsSort>({ field: "spent", direction: "desc" });
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const sortHydratedRef = useRef(false);
  const {
    onlyRunning,
    setOnlyRunning,
    enabledOnly,
    setEnabledOnly,
    statusFilter,
  } = useGoogleAdsDeliveryEnabledFilters(entity);

  const {
    data: accountsRaw = [],
    isPending: accountsPending,
    isFetching: accountsFetching,
    dataUpdatedAt: accountsDataUpdatedAt,
  } = useQuery({
    queryKey: ["google-ads-accounts-picker-metrics", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("organization_google_ads_accounts")
        .select("id, label, customer_id, is_default")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(organizationId) && canManage && oauthConnected,
  });

  const accounts = useMemo(
    () => (oauthConnected ? accountsRaw : []),
    [oauthConnected, accountsRaw],
  );

  const accountsListPending =
    oauthConnected && (accountsPending || (accountsFetching && accountsDataUpdatedAt === 0));
  const accountsNavPending = settingsPending || accountsListPending;

  useEffect(() => {
    if (!oauthConnected && googleCustomerId) {
      setGoogleCustomerId("");
    }
  }, [oauthConnected, googleCustomerId, setGoogleCustomerId]);

  const effectiveCustomerId = useMemo(() => {
    if (googleCustomerId) return googleCustomerId;
    const def = accounts.find((a) => a.is_default);
    return def?.customer_id ?? accounts[0]?.customer_id ?? "";
  }, [googleCustomerId, accounts]);

  useEffect(() => {
    setSelectedCampaignId(null);
  }, [effectiveCustomerId]);

  const { data: accountDateBounds } = useGoogleAdsAccountDateBounds(
    organizationId,
    effectiveCustomerId,
    canManage && reportingEnabled && Boolean(effectiveCustomerId),
  );

  useEffect(() => {
    const earliest = accountDateBounds?.earliest_date;
    if (!earliest) return;
    setDateSelection((prev) => {
      if (prev.preset !== "all_time") return prev;
      const range = computePresetRange("all_time", new Date(), {
        accountEarliestYmd: earliest,
      });
      const nextFrom = range.from ? toYmdLocal(range.from) : null;
      const nextTo = range.to ? toYmdLocal(range.to) : null;
      const prevFrom = prev.range.from ? toYmdLocal(prev.range.from) : null;
      const prevTo = prev.range.to ? toYmdLocal(prev.range.to) : null;
      if (prevFrom === nextFrom && prevTo === nextTo) return prev;
      return { ...prev, range };
    });
  }, [accountDateBounds?.earliest_date, setDateSelection]);

  const calendarYearPresetYears = useMemo(
    () => buildReportYearOptionsFromEarliest(accountDateBounds?.earliest_date),
    [accountDateBounds?.earliest_date],
  );

  const dateRangePayload = useMemo(
    () => toGoogleAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );

  const { data: catalogData } = useGoogleAdsMetricCatalog(organizationId, entity, true);
  const { columnSets } = useGoogleAdsColumnSets(organizationId, entity, true);

  const campaignsListEnabled =
    Boolean(organizationId && effectiveCustomerId) &&
    canManage &&
    reportingEnabled;

  const campaignsQuery = useGoogleAdsCampaignList(
    organizationId,
    effectiveCustomerId,
    statusFilter,
    campaignsListEnabled,
  );
  const campaigns = campaignsQuery.data ?? [];

  const {
    customColumns: uiCustomColumns,
  } = useGoogleAdsUiCustomColumns(
    organizationId,
    effectiveCustomerId,
    entity,
    canManage && reportingEnabled && Boolean(effectiveCustomerId),
  );

  const uiCustomColumnByKey = useMemo(() => {
    const map = new Map<string, (typeof uiCustomColumns)[number]>();
    for (const col of uiCustomColumns) {
      map.set(col.key, col);
    }
    return map;
  }, [uiCustomColumns]);

  const validMetricKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of catalogData?.categories ?? []) {
      for (const m of c.metrics) keys.add(m.key);
    }
    for (const m of catalogData?.recommended.metrics ?? []) {
      keys.add(m.key);
    }
    for (const col of uiCustomColumns) {
      keys.add(col.key);
    }
    for (const col of GOOGLE_ADS_OPTIONAL_IDENTITY_COLUMNS[entity]) {
      keys.add(col.key);
    }
    return keys.size > 0 ? keys : null;
  }, [catalogData, uiCustomColumns, entity]);

  const {
    selectedMetrics,
    storedSort,
    save: saveMetrics,
    saveSort,
    isPending: prefsPending,
  } = useGoogleAdsMetricsPreferences(organizationId, entity, validMetricKeys);

  const { data: conversionActionsData } = useGoogleAdsConversionActions(
    organizationId,
    effectiveCustomerId,
    canManage && reportingEnabled && Boolean(effectiveCustomerId),
  );
  const conversionActions = conversionActionsData ?? EMPTY_CONVERSION_ACTIONS;

  const summaryMetricOptions = useMemo(
    () => buildSummaryMetricOptions(entity, catalogData, conversionActions),
    [catalogData, conversionActions],
  );

  const { summarySlotMetricKeys, handleSummarySlotMetricChange } =
    useGoogleAdsSummarySlotMetrics(entity, summaryMetricOptions);

  const selectedMetricsForEntity = useMemo(() => {
    if (!validMetricKeys) return selectedMetrics;
    return filterGoogleAdsPreferenceMetricKeys(entity, selectedMetrics, validMetricKeys);
  }, [selectedMetrics, validMetricKeys, entity]);

  const apiMetricKeys = useMemo(() => {
    const keys = stripGoogleAdsPinnedMetricKeys(selectedMetricsForEntity).filter(
      (k) => !isOptionalIdentityColumnKey(entity, k),
    );
    return ["spent", ...keys];
  }, [selectedMetricsForEntity, entity]);

  const metricItems = useMemo(() => {
    const cats = catalogData?.categories ?? [];
    const map = new Map<string, (typeof cats)[0]["metrics"][0]>();
    for (const m of catalogData?.recommended.metrics ?? []) {
      map.set(m.key, m);
    }
    for (const c of cats) {
      for (const m of c.metrics) map.set(m.key, m);
    }
    return stripGoogleAdsPinnedMetricKeys(selectedMetricsForEntity)
      .map((k) => {
        const catalogMetric = map.get(k);
        if (catalogMetric) return catalogMetric;
        const uiCustom = uiCustomColumnByKey.get(k);
        if (!uiCustom) return null;
        return {
          key: uiCustom.key,
          label: uiCustom.label,
          description: uiCustom.description,
          entities: ["campaign", "ad_group", "ad", "keyword"] as GoogleAdsMetricEntity[],
          valueKind: "count" as const,
          defaultSelected: false,
          sortable: false,
        };
      })
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
  }, [catalogData, uiCustomColumnByKey, selectedMetricsForEntity]);

  const matchedColumnSet = useMemo(
    () => findMatchingGoogleAdsColumnSet(columnSets, selectedMetricsForEntity),
    [columnSets, selectedMetricsForEntity],
  );

  const sortColumnOptions = useMemo(
    () => buildSortColumnOptions(entity, selectedMetricsForEntity, metricItems),
    [entity, selectedMetricsForEntity, metricItems],
  );

  useEffect(() => {
    sortHydratedRef.current = false;
  }, [organizationId, entity]);

  useEffect(() => {
    if (prefsPending || sortColumnOptions.length === 0) return;
    if (sortHydratedRef.current) return;
    sortHydratedRef.current = true;
    setSort(
      parseStoredSort(
        storedSort.field,
        storedSort.direction,
        sortColumnOptions,
        entity,
        metricItems,
      ),
    );
  }, [prefsPending, storedSort, sortColumnOptions, entity, metricItems]);

  useEffect(() => {
    if (sortColumnOptions.length === 0) return;
    setSort((current) => {
      const next = resolveSortForOptions(current, sortColumnOptions, entity, metricItems);
      if (next.field === current.field && next.direction === current.direction) return current;
      return next;
    });
  }, [sortColumnOptions, metricItems, entity]);

  const sortFieldValue = useMemo(() => {
    if (sortColumnOptions.some((o) => o.key === sort.field)) return sort.field;
    return sortColumnOptions[0]?.key ?? sort.field;
  }, [sort.field, sortColumnOptions]);

  const handleSortFieldChange = useCallback(
    (field: string) => {
      const kind = getSortColumnKind(field, entity, metricItems);
      const next: GoogleAdsMetricsSort = {
        field,
        direction: defaultSortDirectionForKind(kind),
      };
      setSort(next);
      void saveSort.mutateAsync(next);
    },
    [entity, metricItems, saveSort],
  );

  const handleSortDirectionChange = useCallback(
    (direction: "asc" | "desc") => {
      const next: GoogleAdsMetricsSort = { field: sortFieldValue, direction };
      setSort(next);
      void saveSort.mutateAsync(next);
    },
    [sortFieldValue, saveSort],
  );

  const handleApplyMetrics = useCallback(
    async (keys: string[]) => {
      try {
        const metricMap = new Map(metricItems.map((m) => [m.key, m]));
        for (const c of catalogData?.categories ?? []) {
          for (const m of c.metrics) metricMap.set(m.key, m);
        }
        for (const m of catalogData?.recommended.metrics ?? []) {
          metricMap.set(m.key, m);
        }
        for (const col of uiCustomColumns) {
          metricMap.set(col.key, {
            key: col.key,
            label: col.label,
            description: col.description,
            entities: ["campaign", "ad_group", "ad", "keyword"] as GoogleAdsMetricEntity[],
            valueKind: "count",
            defaultSelected: false,
            sortable: false,
          });
        }
        const itemsAfterApply = keys
          .map((k) => metricMap.get(k))
          .filter((m): m is NonNullable<typeof m> => Boolean(m));
        const optionsAfterApply = buildSortColumnOptions(entity, keys, itemsAfterApply);
        const nextSort = resolveSortForOptions(sort, optionsAfterApply, entity, itemsAfterApply);
        setSort(nextSort);
        await saveMetrics.mutateAsync({ selectedMetrics: keys, sort: nextSort });
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [metricItems, catalogData, uiCustomColumns, saveMetrics, sort, entity],
  );

  const handleSwitchColumnSet = useCallback(
    async (setId: string) => {
      if (matchedColumnSet?.id === setId) return;
      const set = columnSets.find((s) => s.id === setId);
      if (!set) return;
      const keys = filterGoogleAdsPreferenceMetricKeys(entity, set.metric_keys, validMetricKeys);
      if (keys.length === 0) {
        toast.error(
          t(
            "digitalMarketing.googleAds.columnSetEmpty",
            "This column set has no available columns for this view.",
          ),
        );
        return;
      }
      await handleApplyMetrics(keys);
    },
    [matchedColumnSet?.id, columnSets, validMetricKeys, handleApplyMetrics, t, entity],
  );

  const metricsFilters = useMemo(() => {
    if (!effectiveCustomerId || apiMetricKeys.length === 0) return null;
    return {
      customerId: effectiveCustomerId,
      entity,
      metrics: apiMetricKeys,
      dateRange: dateRangePayload,
      onlyRunning,
      statusFilter,
      pageToken: "",
      pageSize: MOBILE_PAGE_SIZE,
      sort,
      campaignFilterId: selectedCampaignId ?? undefined,
      summaryMetrics: summarySlotMetricKeys,
    };
  }, [
    effectiveCustomerId,
    entity,
    apiMetricKeys,
    dateRangePayload,
    onlyRunning,
    statusFilter,
    sort,
    selectedCampaignId,
    summarySlotMetricKeys,
  ]);

  const metricsEnabled =
    canManage &&
    reportingEnabled &&
    Boolean(effectiveCustomerId) &&
    !gatePending &&
    !prefsPending;

  const metricsQuery = useGoogleAdsMetricsQuery(organizationId, metricsFilters, metricsEnabled);


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
    if (!organizationId || !metricsFilters || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const key = buildGoogleAdsMetricsQueryKey(organizationId, metricsFilters);
      const fresh = await fetchGoogleAdsMetricsFresh(organizationId, metricsFilters);
      queryClient.setQueryData(key, fresh);
    } finally {
      setIsRefreshing(false);
    }
  }, [organizationId, metricsFilters, isRefreshing, queryClient]);

  const showContentGate = !gatePending && canManage;
  const summaryLoading =
    reportingPending ||
    accountsNavPending ||
    prefsPending ||
    (metricsEnabled && metricsQuery.isPending);
  const tableLoading =
    prefsPending || (metricsEnabled && (metricsQuery.isPending || metricsQuery.isFetching));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/70">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex flex-col bg-muted/70" style={mainFixedStyle}>
          <GoogleAdsMobileShellHeader
            onRefresh={showContentGate && oauthConnected ? handleRefresh : undefined}
            refreshDisabled={isRefreshing || metricsQuery.isFetching}
            isRefreshing={isRefreshing || metricsQuery.isFetching}
            headerActions={
              showContentGate && oauthConnected ? (
                <MobileManageCommentsAccountButton
                  accounts={accounts.map((a) => ({
                    value: a.customer_id,
                    label: a.label?.trim() || a.customer_id,
                  }))}
                  accountId={effectiveCustomerId}
                  onAccountIdChange={setGoogleCustomerId}
                  accountsLoading={accountsNavPending}
                />
              ) : undefined
            }
          />

          <ModuleShellContentGate
            pagePath={MOBILE_PAGE_PATH.digitalMarketingGoogleAds}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {hasPageAccess ? (
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="mx-auto min-w-0 w-full max-w-md space-y-2 px-2 pt-2 content-padding-above-nav-default">
                  {!canManage && !gatePending ? (
                    <Alert>
                      <AlertTitle>
                        {t(
                          "digitalMarketing.googleAds.accessDeniedTitle",
                          "Access restricted",
                        )}
                      </AlertTitle>
                      <AlertDescription>
                        {t(
                          "digitalMarketing.googleAds.accessDeniedBody",
                          "Only the organization owner or an omnichannel admin can view Google Ads metrics.",
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {canManage && !oauthConnected && !settingsPending ? (
                    <Alert>
                      <AlertTitle>
                        {t(
                          "digitalMarketing.googleAds.notConnectedTitle",
                          "Not connected",
                        )}
                      </AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>
                          {t(
                            "digitalMarketing.googleAds.notConnectedBody",
                            "Connect Google Ads and add at least one customer account.",
                          )}
                        </p>
                        <Button asChild variant="outline" size="sm">
                          <Link to={GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH}>
                            {t(
                              "digitalMarketing.googleAds.settingsLink",
                              "Google Ads settings",
                            )}
                          </Link>
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {canManage && oauthConnected ? (
                    <>
                      {reportingEnabled && effectiveCustomerId ? (
                        <MobileGoogleAdsSummaryBar
                          customerId={effectiveCustomerId}
                          totals={metricsQuery.data?.summary_totals}
                          currencyCode={metricsQuery.data?.currency_code ?? null}
                          isLoading={summaryLoading}
                          metricKeys={summarySlotMetricKeys}
                          onMetricKeyChange={handleSummarySlotMetricChange}
                          summaryMetricOptions={summaryMetricOptions}
                          organizationId={organizationId}
                          metricsFilters={metricsFilters}
                          compareEnabled={metricsEnabled}
                        />
                      ) : null}

                      <MobileGoogleAdsFilterStrip
                        accounts={accounts}
                        customerId={effectiveCustomerId}
                        onCustomerIdChange={setGoogleCustomerId}
                        accountsLoading={accountsNavPending}
                        showAccount={false}
                        dateSelection={dateSelection}
                        onDateSelectionChange={setDateSelection}
                        filtersHydrated={filtersHydrated}
                        accountEarliestYmd={accountDateBounds?.earliest_date}
                        calendarYearPresetYears={calendarYearPresetYears}
                        onCustomDateClick={() => setShowCustomDatePicker(true)}
                        entity={entity}
                        onEntityChange={setEntity}
                        showEntity={reportingEnabled && Boolean(effectiveCustomerId)}
                        campaigns={campaigns}
                        selectedCampaignId={selectedCampaignId}
                        onCampaignChange={setSelectedCampaignId}
                        campaignsLoading={campaignsQuery.isLoading}
                        showCampaign={reportingEnabled && Boolean(effectiveCustomerId)}
                        columnSets={columnSets}
                        activeColumnSetId={matchedColumnSet?.id}
                        onColumnSetSelect={(id) => void handleSwitchColumnSet(id)}
                        columnSetDisabled={saveMetrics.isPending}
                        columnSetLoading={prefsPending}
                        showColumnSet={reportingEnabled && Boolean(effectiveCustomerId)}
                        sort={sort}
                        sortColumnOptions={sortColumnOptions}
                        metricItems={metricItems}
                        onSortFieldChange={handleSortFieldChange}
                        onSortDirectionChange={handleSortDirectionChange}
                        showSort={reportingEnabled && Boolean(effectiveCustomerId)}
                        onlyRunning={onlyRunning}
                        onOnlyRunningChange={setOnlyRunning}
                        enabledOnly={enabledOnly}
                        onEnabledOnlyChange={setEnabledOnly}
                        showDeliveryEnabled={reportingEnabled && Boolean(effectiveCustomerId)}
                      />

                      {reportingEnabled && effectiveCustomerId ? (
                        <MobileGoogleAdsMetricsTable
                          entity={entity}
                          rows={metricsQuery.data?.rows ?? []}
                          selectedColumnKeys={selectedMetricsForEntity}
                          metricItems={metricItems}
                          currencyCode={metricsQuery.data?.currency_code ?? null}
                          isLoading={tableLoading && !metricsQuery.data}
                        />
                      ) : null}

                      {metricsQuery.isError ? (
                        <Alert>
                          <AlertTitle>
                            {t("common.error", "Error")}
                          </AlertTitle>
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

export default function MobileGoogleAdsPage() {
  useStatusBarStyle("light");
  const { isKeyboardShellOpen } = useVisualViewport();
  const { outerShellClassName, mainShellClassName, mainShellStyle } = useMobileToolsShellLayout();
  const pagePath = MOBILE_PAGE_PATH.digitalMarketingGoogleAds;
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
            <GoogleAdsMobileShellHeader />
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

  return <MobileGoogleAdsPageContent hasPageAccess={hasPageAccess} />;
}
