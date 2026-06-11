import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Columns3, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useMetaAdsReportingEnabled } from "@/meta-ads/hooks/useMetaAdsReportingEnabled";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import {
  fetchMetaAdsMetrics,
  useMetaAdsMetricsQuery,
  type MetaAdsMetricEntity,
  type MetaAdsMetricsRow,
} from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { MetaAdsSettingsPanel } from "@/meta-ads/settings/MetaAdsSettingsPanel";
import {
  META_ADS_DIGITAL_MARKETING_BASE_PATH,
  META_ADS_DIGITAL_MARKETING_SETTINGS_PATH,
} from "@/meta-ads/settings/metaAdsSettingsPaths";
import { MetaAdsMetricsPageSkeleton } from "@/6-0-meta-ads/skeletons/MetaAdsMetricsPageSkeleton";
import { MetaAdsEntityNav, type MetaAdsNavAccount } from "@/6-0-meta-ads/components/MetaAdsEntityNav";
import { MetaAdsMetricsSummaryBar } from "@/6-0-meta-ads/components/MetaAdsMetricsSummaryBar";
import { MetaAdsMetricsTable } from "@/6-0-meta-ads/components/MetaAdsMetricsTable";
import { MetaAdsMetricsTableFooter } from "@/6-0-meta-ads/components/MetaAdsMetricsTableFooter";
import { MetaAdsModifyColumnsDialog } from "@/6-0-meta-ads/components/MetaAdsModifyColumnsDialog";
import { MetaAdsDateRangePicker } from "@/6-0-meta-ads/components/MetaAdsDateRangePicker";
import { useMetaAdsMetricsPreferences } from "@/meta-ads/hooks/useMetaAdsMetricsPreferences";
import {
  useMetaAdsColumnSets,
  type MetaAdsColumnSet,
} from "@/meta-ads/hooks/useMetaAdsColumnSets";
import {
  META_ADS_COLUMN_SET_SELECT_ITEM_CLASS,
  MetaAdsColumnSetOptionLabel,
} from "@/meta-ads/components/MetaAdsColumnSetOptionLabel";
import {
  buildMetaAdsMetricCatalogResponse,
  getMetaAdsCatalogMetricKeys,
  getMetaAdsMetricsForEntity,
  isMetaAdsSynckerjaMetricKey,
  resolveMetaAdsMetricItems,
} from "@/meta-ads/metrics/metaAdsMetricCatalog";
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
import { endOfDay } from "date-fns";
import { parseYmdLocal, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import {
  buildMetaAdsCalendarYearPresetYears,
  metaAdsAllTimeDateRange,
} from "@/meta-ads/lib/clampMetaAdsDateRange";
import { toMetaAdsMetricsDateRangePayload } from "@/meta-ads/lib/toMetaAdsMetricsDateRangePayload";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  buildMetaAdsSortColumnOptions,
  defaultMetaAdsSortDirection,
  getMetaAdsSortColumnKind,
  resolveSortForOptions,
  type MetaAdsMetricsSort,
} from "@/meta-ads/metrics/metaAdsSortColumns";
import { sortMetaAdsRows } from "@/meta-ads/metrics/sortMetaAdsRows";
import { useServices } from "@/6-1-product-knowledge/hooks/useServices";
import {
  resolveCampaignIdFromMetaMetricsRow,
  useMetaAdsCampaignServiceMapping,
} from "@/meta-ads/hooks/useMetaAdsCampaignServiceMapping";

function columnKeysMatch(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function columnKeysMatchOrderIndependent(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((key, index) => key === sortedB[index]);
}

function findMatchingColumnSet(
  columnSets: MetaAdsColumnSet[],
  keys: string[],
): MetaAdsColumnSet | null {
  if (keys.length === 0) return null;
  const orgMatch =
    columnSets.find(
      (set) => set.scope === "org" && columnKeysMatch(set.metric_keys, keys),
    ) ??
    columnSets.find(
      (set) =>
        set.scope === "org" && columnKeysMatchOrderIndependent(set.metric_keys, keys),
    );
  if (orgMatch) return orgMatch;
  return (
    columnSets.find((set) => columnKeysMatch(set.metric_keys, keys)) ??
    columnSets.find((set) => columnKeysMatchOrderIndependent(set.metric_keys, keys)) ??
    null
  );
}

export default function MetaAdsMetricsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <MetaAdsMetricsPageSkeleton />;
  return (
    <ModuleShellContentGate pagePath="/digital-marketing/meta-ads">
      <MetaAdsMetricsPageContent />
    </ModuleShellContentGate>
  );
}

function MetaAdsMetricsPageContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsView = location.pathname === META_ADS_DIGITAL_MARKETING_SETTINGS_PATH;
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useMetaAdsReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useMetaAdsSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });

  const { dateSelection, setDateSelection, metaAdAccountId, setMetaAdAccountId } =
    useDigitalMarketingPaidAdsFilters();
  const [entity, setEntity] = useState<MetaAdsMetricEntity>("campaign");
  const [summarySlotMetricKeys, setSummarySlotMetricKeys] = useState<MetaAdsTableMetricKey[]>(
    () => [...META_ADS_SUMMARY_DEFAULT_SLOT_KEYS],
  );
  const adAccountId = metaAdAccountId;
  const setAdAccountId = setMetaAdAccountId;
  const [sort, setSort] = useState<MetaAdsMetricsSort>({ field: "spend", direction: "desc" });
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const sortHydratedForEntityRef = useRef<string | null>(null);

  const validMetricKeys = useMemo(() => getMetaAdsCatalogMetricKeys(), []);
  const catalogData = useMemo(() => buildMetaAdsMetricCatalogResponse(entity), [entity]);

  const { columnSets, save: saveColumnSet, remove: removeColumnSet } = useMetaAdsColumnSets(
    organizationId,
    entity,
    true,
  );

  const {
    visibleColumns: selectedMetrics,
    storedSort,
    isPending: prefsPending,
    save: saveMetrics,
    saveSort,
  } = useMetaAdsMetricsPreferences(organizationId, entity, validMetricKeys);

  /** All time on Meta = 37 months (not Google account earliest). */
  useEffect(() => {
    if (dateSelection.preset !== "all_time") return;
    const { start, end } = metaAdsAllTimeDateRange();
    const from = parseYmdLocal(start);
    const to = parseYmdLocal(end);
    if (!from || !to) return;
    const nextTo = endOfDay(to);
    const curFrom = dateSelection.range.from
      ? toYmdLocal(dateSelection.range.from)
      : "";
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
    () => (settings?.accounts ?? []).filter((a) => a.is_active),
    [settings?.accounts],
  );

  /** Accounts with a real Pixel ID — required for insights API and CAPI. */
  const metricsReadyAccounts = useMemo(
    () => allActiveAccounts.filter((a) => a.pixel_id !== "0"),
    [allActiveAccounts],
  );

  const navAccounts: MetaAdsNavAccount[] = useMemo(
    () =>
      allActiveAccounts.map((a) => ({
        id: a.id,
        label: a.label,
        ad_account_id: a.ad_account_id,
        is_default: a.is_default,
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

  const allEntityMetricItems = useMemo(() => getMetaAdsMetricsForEntity(entity), [entity]);

  const metricItems = useMemo(
    () => resolveMetaAdsMetricItems(selectedMetrics, entity),
    [selectedMetrics, entity],
  );

  const matchedColumnSet = useMemo(
    () => findMatchingColumnSet(columnSets, selectedMetrics),
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

  const metricsQuery = useMetaAdsMetricsQuery({
    organizationId,
    adAccountId,
    entity,
    dateStart,
    dateEnd,
    enabled:
      reportingEnabled &&
      Boolean(adAccountId) &&
      metricsReadyAccounts.some((a) => a.ad_account_id === adAccountId) &&
      !isSettingsView &&
      canManage,
  });

  const handleRefreshMetrics = useCallback(async () => {
    if (!organizationId || !adAccountId) return;
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
    }
  }, [
    organizationId,
    adAccountId,
    entity,
    dateStart,
    dateEnd,
    queryClient,
    metricsQuery,
  ]);

  const sortFieldValue = useMemo(() => {
    if (sortColumnOptions.some((o) => o.key === sort.field)) return sort.field;
    return sortColumnOptions[0]?.key ?? "spend";
  }, [sort.field, sortColumnOptions]);

  const sortedRows = useMemo(() => {
    const rows = metricsQuery.data?.rows ?? [];
    return sortMetaAdsRows(rows, { field: sortFieldValue, direction: sort.direction }, entity);
  }, [metricsQuery.data?.rows, sortFieldValue, sort.direction, entity]);

  const handleSortFieldChange = (field: string) => {
    const kind = getMetaAdsSortColumnKind(field);
    const next: MetaAdsMetricsSort = {
      field,
      direction: defaultMetaAdsSortDirection(kind),
    };
    setSort(next);
    void saveSort.mutateAsync(next);
  };

  const handleSortDirectionChange = (direction: "asc" | "desc") => {
    const next: MetaAdsMetricsSort = { field: sortFieldValue, direction };
    setSort(next);
    void saveSort.mutateAsync(next);
  };

  const handleSwitchColumnSet = async (setId: string) => {
    if (matchedColumnSet?.id === setId) return;
    const set = columnSets.find((s) => s.id === setId);
    if (!set) return;
    const keys = set.metric_keys.filter(
      (k) => validMetricKeys.has(k) || isMetaAdsSynckerjaMetricKey(k),
    );
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
  };

  const handleApplyMetrics = async (
    keys: string[],
    options?: { saveColumnSetName?: string },
  ) => {
    try {
      const itemsAfterApply = resolveMetaAdsMetricItems(keys, entity);
      const optionsAfterApply = buildMetaAdsSortColumnOptions(
        entity,
        itemsAfterApply.map((m) => m.key),
      );
      const nextSort = resolveSortForOptions(sort, optionsAfterApply);
      setSort(nextSort);
      await saveMetrics.mutateAsync({ visibleColumns: keys, sort: nextSort });
      if (options?.saveColumnSetName) {
        await saveColumnSet.mutateAsync({
          name: options.saveColumnSetName,
          metric_keys: keys,
        });
        toast.success("Column set saved");
      }
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  };

  const { data: orgServices = [] } = useServices();
  const serviceMappingMutation = useMetaAdsCampaignServiceMapping();

  const handleServiceMappingChange = async (
    row: MetaAdsMetricsRow,
    serviceId: string | null,
  ) => {
    if (!organizationId || !adAccountId) return;
    const campaignId = resolveCampaignIdFromMetaMetricsRow(row);
    if (!campaignId) {
      toast.error(
        t(
          "digitalMarketing.metaAds.serviceMappingCampaignError",
          "Tidak dapat mengenali campaign.",
        ),
      );
      return;
    }
    try {
      await serviceMappingMutation.mutateAsync({
        organizationId,
        adAccountId,
        campaignId,
        serviceId,
      });
      toast.success(
        t("digitalMarketing.metaAds.serviceMappingSaved", "Mapping service disimpan."),
      );
      void metricsQuery.refetch();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("digitalMarketing.metaAds.serviceMappingFailed", "Gagal menyimpan mapping."),
      );
    }
  };

  const metricsTableLoading =
    metricsQuery.isLoading || (metricsQuery.isFetching && !metricsQuery.data);

  const accountSelectReady = !settingsPending && navAccounts.length > 0;
  const rawPageLoadPending = gatePending || reportingPending || (canManage && settingsPending);

  if (rawPageLoadPending) {
    return <MetaAdsMetricsPageSkeleton />;
  }

  return (
    <>
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="mb-1 min-w-0 shrink-0">
                  <HeaderAndTab />
                </div>

                <div className="grid min-h-0 min-w-0 w-full flex-1 basis-0 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    {!canManage ? (
                      <div className="p-6">
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
                            )}{" "}
                            <Link
                              to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                              className="font-medium text-primary underline"
                            >
                              {t("digitalMarketing.metaAds.settingsLink", "Meta Ads settings")}
                            </Link>
                          </AlertDescription>
                        </Alert>
                      </div>
                    ) : (
                      <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
                        <MetaAdsEntityNav
                          entity={entity}
                          onEntityChange={(next) => {
                            setEntity(next);
                            if (isSettingsView) {
                              navigate(META_ADS_DIGITAL_MARKETING_BASE_PATH);
                            }
                          }}
                          accounts={navAccounts}
                          adAccountId={adAccountId}
                          accountSelectReady={accountSelectReady}
                          accountsPending={settingsPending}
                          onAdAccountIdChange={setAdAccountId}
                          settingsActive={isSettingsView}
                          onSettingsSelect={() =>
                            navigate(META_ADS_DIGITAL_MARKETING_SETTINGS_PATH)
                          }
                        />

                        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                          {isSettingsView ? (
                            <MetaAdsSettingsPanel
                              organizationId={organizationId}
                              oauthReturnPath={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                              contentClassName="p-4"
                            />
                          ) : (
                            <>
                              <div className="shrink-0 space-y-3 border-b border-gray-200 p-4 [@media(max-height:900px)]:space-y-2 [@media(max-height:900px)]:p-3">
                                {!reportingPending && !reportingEnabled ? (
                                  <Alert>
                                    <AlertTitle>
                                      {t(
                                        "digitalMarketing.metaAds.notConnected",
                                        "Meta Ads not connected",
                                      )}
                                    </AlertTitle>
                                    <AlertDescription>
                                      {t(
                                        "digitalMarketing.metaAds.notConnectedHint",
                                        "Connect Meta Ads in Offline Conversion settings to view metrics.",
                                      )}{" "}
                                      <Link
                                        to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                        className="font-medium text-primary underline"
                                      >
                                        {t(
                                          "digitalMarketing.metaAds.settingsLink",
                                          "Settings",
                                        )}
                                      </Link>
                                    </AlertDescription>
                                  </Alert>
                                ) : null}

                                {metricsReadyAccounts.length === 0 &&
                                allActiveAccounts.length > 0 &&
                                reportingEnabled ? (
                                  <Alert>
                                    <AlertTitle>
                                      {t(
                                        "digitalMarketing.metaAds.pixelRequiredTitle",
                                        "Pixel ID required",
                                      )}
                                    </AlertTitle>
                                    <AlertDescription>
                                      {t(
                                        "digitalMarketing.metaAds.pixelRequiredHint",
                                        "Your ad accounts are synced but still use Pixel 0. Open Settings, click Edit on each account, and paste the Pixel ID from Meta Events Manager.",
                                      )}{" "}
                                      <Link
                                        to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                        className="font-medium text-primary underline"
                                      >
                                        {t(
                                          "digitalMarketing.metaAds.settingsLink",
                                          "Settings",
                                        )}
                                      </Link>
                                    </AlertDescription>
                                  </Alert>
                                ) : null}

                                {allActiveAccounts.length === 0 && reportingEnabled ? (
                                  <Alert>
                                    <AlertTitle>
                                      {t(
                                        "digitalMarketing.metaAds.noAccountsTitle",
                                        "No ad accounts ready",
                                      )}
                                    </AlertTitle>
                                    <AlertDescription>
                                      {t(
                                        "digitalMarketing.metaAds.noAccountsHint",
                                        "Sync ad accounts in Settings and set a Pixel ID for each account you want to report on.",
                                      )}{" "}
                                      <Link
                                        to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                        className="font-medium text-primary underline"
                                      >
                                        {t(
                                          "digitalMarketing.metaAds.settingsLink",
                                          "Settings",
                                        )}
                                      </Link>
                                    </AlertDescription>
                                  </Alert>
                                ) : null}

                                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    title={t(
                                      "digitalMarketing.metaAds.refreshData",
                                      "Refresh metrics from Meta",
                                    )}
                                    disabled={
                                      !reportingEnabled ||
                                      !adAccountId ||
                                      metricsQuery.isFetching
                                    }
                                    onClick={() => void handleRefreshMetrics()}
                                  >
                                    {metricsQuery.isFetching ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>

                                  <MetaAdsDateRangePicker
                                    value={dateSelection}
                                    calendarYearPresetYears={calendarYearPresetYears}
                                    calendarYearFilterHint={t(
                                      "digitalMarketing.metaAds.calendarYearFilterHint",
                                      "Open the month header dropdown and click a year (e.g. 2023) to filter that calendar year.",
                                    )}
                                    onChange={setDateSelection}
                                  />

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 shrink-0"
                                    disabled={!reportingEnabled || prefsPending}
                                    onClick={() => setMetricsDialogOpen(true)}
                                  >
                                    <Columns3 className="mr-2 h-4 w-4" />
                                    {t("digitalMarketing.metaAds.metricsButton", "Metrics")}
                                  </Button>
                                </div>
                              </div>

                              {reportingEnabled && adAccountId ? (
                                <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-1 [@media(max-height:900px)]:px-3 [@media(max-height:900px)]:pb-2">
                                  <MetaAdsMetricsSummaryBar
                                    entity={entity}
                                    adAccountId={adAccountId}
                                    summary={
                                      metricsTableLoading ? undefined : metricsQuery.data?.summary
                                    }
                                    rows={sortedRows}
                                    catalogItems={allEntityMetricItems}
                                    metricKeys={summarySlotMetricKeys}
                                    onMetricKeysChange={(keys) => {
                                      setSummarySlotMetricKeys(keys);
                                      saveMetaAdsSummarySlotMetrics(entity, keys);
                                    }}
                                    isLoading={metricsTableLoading}
                                  />
                                </div>
                              ) : null}

                              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-gray-100">
                                {columnSets.length > 0 ? (
                                  <div className="flex shrink-0 items-center gap-2 px-4 py-2 [@media(max-height:900px)]:px-3 [@media(max-height:900px)]:py-1.5">
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      {t(
                                        "digitalMarketing.metaAds.activeColumnSet",
                                        "Column set",
                                      )}
                                    </span>
                                    <Select
                                      value={matchedColumnSet?.id}
                                      onValueChange={(id) => void handleSwitchColumnSet(id)}
                                      disabled={saveMetrics.isPending}
                                    >
                                      <SelectTrigger className="h-7 w-auto min-w-[10rem] max-w-[min(20rem,100%)] border-gray-200 bg-white text-xs font-medium shadow-none">
                                        <SelectValue
                                          placeholder={t(
                                            "digitalMarketing.metaAds.chooseColumnSet",
                                            "Choose a saved set",
                                          )}
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {columnSets.map((set) => (
                                          <SelectItem
                                            key={set.id}
                                            value={set.id}
                                            className={cn(
                                              "text-xs",
                                              META_ADS_COLUMN_SET_SELECT_ITEM_CLASS,
                                            )}
                                          >
                                            <MetaAdsColumnSetOptionLabel set={set} />
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ) : null}

                                {metricsQuery.isError ? (
                                  <div className="shrink-0 px-4 pb-2">
                                    <Alert variant="destructive">
                                      <AlertTitle>
                                        {t(
                                          "digitalMarketing.metaAds.error",
                                          "Failed to load metrics",
                                        )}
                                      </AlertTitle>
                                      <AlertDescription>
                                        {(metricsQuery.error as Error).message}
                                      </AlertDescription>
                                    </Alert>
                                  </div>
                                ) : null}

                                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4">
                                  <div className="min-h-0 flex-1 overflow-hidden">
                                    <MetaAdsMetricsTable
                                      entity={entity}
                                      rows={sortedRows}
                                      metricItems={metricItems}
                                      currencyCode={
                                        metricsQuery.data?.summary?.currency ?? null
                                      }
                                      isLoading={metricsTableLoading}
                                      canEditServiceMapping={
                                        entity === "campaign" && canManage
                                      }
                                      services={orgServices.map((s) => ({
                                        id: s.id,
                                        name: s.name,
                                      }))}
                                      onServiceMappingChange={
                                        entity === "campaign"
                                          ? handleServiceMappingChange
                                          : undefined
                                      }
                                      serviceMappingPending={serviceMappingMutation.isPending}
                                    />
                                  </div>

                                  <MetaAdsMetricsTableFooter
                                    totalCount={sortedRows.length}
                                    sort={{ field: sortFieldValue, direction: sort.direction }}
                                    sortColumnOptions={sortColumnOptions}
                                    cached={metricsQuery.data?.cached}
                                    isLoading={metricsTableLoading}
                                    onSortFieldChange={handleSortFieldChange}
                                    onSortDirectionChange={handleSortDirectionChange}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      <MetaAdsModifyColumnsDialog
        open={metricsDialogOpen}
        onOpenChange={setMetricsDialogOpen}
        entity={entity}
        catalog={catalogData}
        selectedKeys={selectedMetrics}
        columnSets={columnSets}
        onApply={handleApplyMetrics}
        onDeleteColumnSet={async (id) => {
          try {
            const target = columnSets.find((s) => s.id === id);
            if (target?.scope === "global") return;
            await removeColumnSet.mutateAsync({ id, scope: target?.scope });
            toast.success("Column set deleted");
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
        onUpdateColumnSet={async ({ id, name, metric_keys }) => {
          try {
            const target = columnSets.find((s) => s.id === id);
            if (target?.scope === "global") return { id };
            const existing = columnSets.find((s) => s.id === id);
            const trimmed = name.trim();
            if (existing && existing.name !== trimmed) {
              await removeColumnSet.mutateAsync({ id, scope: "org" });
              const saved = await saveColumnSet.mutateAsync({
                name: trimmed,
                metric_keys,
              });
              toast.success("Column set updated");
              return { id: saved.id };
            }
            const saved = await saveColumnSet.mutateAsync({
              name: trimmed,
              metric_keys,
            });
            toast.success("Column set updated");
            return { id: saved.id };
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
        isSaving={saveMetrics.isPending || saveColumnSet.isPending}
        isDeletingColumnSet={removeColumnSet.isPending}
        isUpdatingColumnSet={saveColumnSet.isPending || removeColumnSet.isPending}
      />
    </>
  );
}
