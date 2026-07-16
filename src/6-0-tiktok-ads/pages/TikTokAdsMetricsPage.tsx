import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Columns3, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { endOfDay } from "date-fns";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { ModuleHeaderBelowContentGate } from "@/shared/layouts/ModuleHeaderBelowContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { parseYmdLocal, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useServices } from "@/6-1-product-knowledge/hooks/useServices";
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
import { useTikTokAdsReportingEnabled } from "@/tiktok-ads/hooks/useTikTokAdsReportingEnabled";
import { useTikTokAdsSettings } from "@/tiktok-ads/hooks/useTikTokAdsSettings";
import {
  fetchTikTokAdsMetrics,
  useTikTokAdsMetricsQuery,
  type TikTokAdsMetricEntity,
  type TikTokAdsMetricsRow,
} from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import { TikTokAdsSettingsPanel } from "@/tiktok-ads/settings/TikTokAdsSettingsPanel";
import {
  TIKTOK_ADS_DIGITAL_MARKETING_BASE_PATH,
  TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH,
} from "@/tiktok-ads/settings/tiktokAdsSettingsPaths";
import { TikTokAdsMetricsPageSkeleton } from "@/6-0-tiktok-ads/skeletons/TikTokAdsMetricsPageSkeleton";
import { TikTokAdsEntityNav, type TikTokAdsNavAccount } from "@/6-0-tiktok-ads/components/TikTokAdsEntityNav";
import { TikTokAdsMetricsSummaryBar } from "@/6-0-tiktok-ads/components/TikTokAdsMetricsSummaryBar";
import { TikTokAdsMetricsTable } from "@/6-0-tiktok-ads/components/TikTokAdsMetricsTable";
import { TikTokAdsMetricsTableFooter } from "@/6-0-tiktok-ads/components/TikTokAdsMetricsTableFooter";
import { TikTokAdsModifyColumnsDialog } from "@/6-0-tiktok-ads/components/TikTokAdsModifyColumnsDialog";
import { TikTokAdsDateRangePicker } from "@/6-0-tiktok-ads/components/TikTokAdsDateRangePicker";
import { useTikTokAdsMetricsPreferences } from "@/tiktok-ads/hooks/useTikTokAdsMetricsPreferences";
import {
  useTikTokAdsColumnSets,
  type TikTokAdsColumnSet,
} from "@/tiktok-ads/hooks/useTikTokAdsColumnSets";
import {
  TIKTOK_ADS_COLUMN_SET_SELECT_ITEM_CLASS,
  TikTokAdsColumnSetOptionLabel,
} from "@/tiktok-ads/components/TikTokAdsColumnSetOptionLabel";
import {
  buildTikTokAdsMetricCatalogResponse,
  getTikTokAdsCatalogMetricKeys,
  getTikTokAdsMetricsForEntity,
  resolveTikTokAdsMetricItems,
} from "@/tiktok-ads/metrics/tiktokAdsMetricCatalog";
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
  buildTikTokAdsCalendarYearPresetYears,
  tiktokAdsAllTimeDateRange,
} from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { toTikTokAdsMetricsDateRangePayload } from "@/tiktok-ads/lib/toTikTokAdsMetricsDateRangePayload";
import {
  buildTikTokAdsSortColumnOptions,
  defaultTikTokAdsSortDirection,
  getTikTokAdsSortColumnKind,
  resolveSortForOptions,
  type TikTokAdsMetricsSort,
} from "@/tiktok-ads/metrics/tiktokAdsSortColumns";
import { sortTikTokAdsRows } from "@/tiktok-ads/metrics/sortTikTokAdsRows";
import {
  resolveCampaignIdFromTikTokMetricsRow,
  useTikTokAdsCampaignServiceMapping,
} from "@/tiktok-ads/hooks/useTikTokAdsCampaignServiceMapping";

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
  columnSets: TikTokAdsColumnSet[],
  keys: string[],
): TikTokAdsColumnSet | null {
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

export default function TikTokAdsMetricsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <TikTokAdsMetricsPageSkeleton />;
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ModuleHeaderBelowContentGate
            pagePath={TIKTOK_ADS_DIGITAL_MARKETING_BASE_PATH}
            header={<HeaderAndTab />}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          >
            <TikTokAdsMetricsPageContent />
          </ModuleHeaderBelowContentGate>
        </div>
      </div>
    </div>
  );
}

function TikTokAdsMetricsPageContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsView = location.pathname === TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH;
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useTikTokAdsReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useTikTokAdsSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });

  const { dateSelection, setDateSelection, tiktokAdvertiserId, setTikTokAdvertiserId } =
    useDigitalMarketingPaidAdsFilters();
  const [entity, setEntity] = useState<TikTokAdsMetricEntity>("campaign");
  const advertiserId = tiktokAdvertiserId;
  const setAdvertiserId = setTikTokAdvertiserId;
  const [summarySlotMetricKeys, setSummarySlotMetricKeys] = useState<TikTokAdsTableMetricKey[]>(
    () => [...TIKTOK_ADS_SUMMARY_DEFAULT_SLOT_KEYS],
  );
  const [sort, setSort] = useState<TikTokAdsMetricsSort>({ field: "spend", direction: "desc" });
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const sortHydratedForEntityRef = useRef<string | null>(null);

  const validMetricKeys = useMemo(() => getTikTokAdsCatalogMetricKeys(), []);
  const catalogData = useMemo(() => buildTikTokAdsMetricCatalogResponse(entity), [entity]);

  const { columnSets, save: saveColumnSet, remove: removeColumnSet } = useTikTokAdsColumnSets(
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
  } = useTikTokAdsMetricsPreferences(organizationId, entity, validMetricKeys);

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

  const oauthConnected = settings?.oauthConnected ?? false;

  const activeAccounts = useMemo(
    () =>
      oauthConnected
        ? (settings?.accounts ?? []).filter((a) => a.is_active)
        : [],
    [settings?.accounts, oauthConnected],
  );

  useEffect(() => {
    if (!oauthConnected && tiktokAdvertiserId) {
      setTikTokAdvertiserId("");
    }
  }, [oauthConnected, tiktokAdvertiserId, setTikTokAdvertiserId]);

  const navAccounts: TikTokAdsNavAccount[] = useMemo(
    () =>
      activeAccounts.map((a) => ({
        id: a.id,
        label: a.label,
        advertiser_id: a.advertiser_id,
        is_default: a.is_default,
      })),
    [activeAccounts],
  );

  useEffect(() => {
    if (!advertiserId && activeAccounts.length > 0) {
      const def = activeAccounts.find((a) => a.is_default) ?? activeAccounts[0];
      setAdvertiserId(def.advertiser_id);
    }
  }, [activeAccounts, advertiserId, setAdvertiserId]);

  const allEntityMetricItems = useMemo(() => getTikTokAdsMetricsForEntity(entity), [entity]);

  const metricItems = useMemo(
    () => resolveTikTokAdsMetricItems(selectedMetrics, entity),
    [selectedMetrics, entity],
  );

  const matchedColumnSet = useMemo(
    () => findMatchingColumnSet(columnSets, selectedMetrics),
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

  const metricsQuery = useTikTokAdsMetricsQuery({
    organizationId,
    advertiserId,
    entity,
    dateStart,
    dateEnd,
    enabled:
      reportingEnabled &&
      Boolean(advertiserId) &&
      activeAccounts.some((a) => a.advertiser_id === advertiserId) &&
      !isSettingsView &&
      canManage,
  });

  const handleRefreshMetrics = useCallback(async () => {
    if (!organizationId || !advertiserId) return;
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
    }
  }, [
    organizationId,
    advertiserId,
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
    return sortTikTokAdsRows(rows, { field: sortFieldValue, direction: sort.direction }, entity);
  }, [metricsQuery.data?.rows, sortFieldValue, sort.direction, entity]);

  const handleSortFieldChange = (field: string) => {
    const kind = getTikTokAdsSortColumnKind(field);
    const next: TikTokAdsMetricsSort = {
      field,
      direction: defaultTikTokAdsSortDirection(kind),
    };
    setSort(next);
    void saveSort.mutateAsync(next);
  };

  const handleSortDirectionChange = (direction: "asc" | "desc") => {
    const next: TikTokAdsMetricsSort = { field: sortFieldValue, direction };
    setSort(next);
    void saveSort.mutateAsync(next);
  };

  const handleSwitchColumnSet = async (setId: string) => {
    if (matchedColumnSet?.id === setId) return;
    const set = columnSets.find((s) => s.id === setId);
    if (!set) return;
    const keys = set.metric_keys.filter((k) => validMetricKeys.has(k));
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
  };

  const handleApplyMetrics = async (
    keys: string[],
    options?: { saveColumnSetName?: string },
  ) => {
    try {
      const itemsAfterApply = resolveTikTokAdsMetricItems(keys, entity);
      const optionsAfterApply = buildTikTokAdsSortColumnOptions(
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
  const serviceMappingMutation = useTikTokAdsCampaignServiceMapping();

  const handleServiceMappingChange = async (
    row: TikTokAdsMetricsRow,
    serviceId: string | null,
  ) => {
    if (!organizationId || !advertiserId) return;
    const campaignId = resolveCampaignIdFromTikTokMetricsRow(row);
    if (!campaignId) {
      toast.error(
        t(
          "digitalMarketing.tiktokAds.serviceMappingCampaignError",
          "Tidak dapat mengenali campaign.",
        ),
      );
      return;
    }
    try {
      await serviceMappingMutation.mutateAsync({
        organizationId,
        advertiserId,
        campaignId,
        serviceId,
      });
      toast.success(
        t("digitalMarketing.tiktokAds.serviceMappingSaved", "Mapping service disimpan."),
      );
      void metricsQuery.refetch();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("digitalMarketing.tiktokAds.serviceMappingFailed", "Gagal menyimpan mapping."),
      );
    }
  };

  const metricsTableLoading =
    metricsQuery.isLoading || (metricsQuery.isFetching && !metricsQuery.data);

  const accountSelectReady = !settingsPending && navAccounts.length > 0;
  const rawPageLoadPending = gatePending || reportingPending || (canManage && settingsPending);

  if (rawPageLoadPending) {
    return null;
  }

  return (
    <>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="grid min-h-0 min-w-0 w-full flex-1 basis-0 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                    <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                      {!canManage ? (
                        <div className="p-6">
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
                              )}{" "}
                              <Link
                                to={TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                className="font-medium text-primary underline"
                              >
                                {t("digitalMarketing.tiktokAds.settingsLink", "TikTok Ads settings")}
                              </Link>
                            </AlertDescription>
                          </Alert>
                        </div>
                      ) : (
                        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
                          <TikTokAdsEntityNav
                            entity={entity}
                            onEntityChange={(next) => {
                              setEntity(next);
                              if (isSettingsView) {
                                navigate(TIKTOK_ADS_DIGITAL_MARKETING_BASE_PATH);
                              }
                            }}
                            accounts={navAccounts}
                            advertiserId={advertiserId}
                            accountSelectReady={accountSelectReady}
                            accountsPending={settingsPending}
                            onAdvertiserIdChange={setAdvertiserId}
                            settingsActive={isSettingsView}
                            onSettingsSelect={() =>
                              navigate(TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH)
                            }
                          />

                          <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                            {isSettingsView ? (
                              <TikTokAdsSettingsPanel
                                organizationId={organizationId}
                                oauthReturnPath={TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                contentClassName="p-4"
                              />
                            ) : (
                              <>
                                <div className="shrink-0 space-y-3 border-b border-gray-200 p-4 [@media(max-height:900px)]:space-y-2 [@media(max-height:900px)]:p-3">
                                  {settings?.serverConfigured === false ? (
                                    <Alert variant="destructive">
                                      <AlertTitle>
                                        {t(
                                          "digitalMarketing.tiktokAds.serverNotConfiguredTitle",
                                          "TikTok Ads server not configured",
                                        )}
                                      </AlertTitle>
                                      <AlertDescription>
                                        {t(
                                          "digitalMarketing.tiktokAds.serverNotConfiguredBody",
                                          "An admin must set TIKTOK_ADS_CLIENT_KEY and TIKTOK_ADS_CLIENT_SECRET in Supabase Edge Function secrets before OAuth and reporting can work.",
                                        )}
                                      </AlertDescription>
                                    </Alert>
                                  ) : !reportingPending && !reportingEnabled ? (
                                    <Alert>
                                      <AlertTitle>
                                        {t(
                                          "digitalMarketing.tiktokAds.notConnected",
                                          "TikTok Ads not connected",
                                        )}
                                      </AlertTitle>
                                      <AlertDescription>
                                        {t(
                                          "digitalMarketing.tiktokAds.notConnectedHint",
                                          "Connect TikTok Ads in settings to view metrics.",
                                        )}{" "}
                                        <Link
                                          to={TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                          className="font-medium text-primary underline"
                                        >
                                          {t(
                                            "digitalMarketing.tiktokAds.settingsLink",
                                            "Settings",
                                          )}
                                        </Link>
                                      </AlertDescription>
                                    </Alert>
                                  ) : null}

                                  {activeAccounts.length === 0 && reportingEnabled ? (
                                    <Alert>
                                      <AlertTitle>
                                        {t(
                                          "digitalMarketing.tiktokAds.noAccountsTitle",
                                          "No advertisers ready",
                                        )}
                                      </AlertTitle>
                                      <AlertDescription>
                                        {t(
                                          "digitalMarketing.tiktokAds.noAccountsHint",
                                          "Sync advertisers in Settings or add one manually.",
                                        )}{" "}
                                        <Link
                                          to={TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                          className="font-medium text-primary underline"
                                        >
                                          {t(
                                            "digitalMarketing.tiktokAds.settingsLink",
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
                                        "digitalMarketing.tiktokAds.refreshData",
                                        "Refresh metrics from TikTok",
                                      )}
                                      disabled={
                                        !reportingEnabled ||
                                        !advertiserId ||
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

                                    <TikTokAdsDateRangePicker
                                      value={dateSelection}
                                      calendarYearPresetYears={calendarYearPresetYears}
                                      calendarYearFilterHint={t(
                                        "digitalMarketing.tiktokAds.calendarYearFilterHint",
                                        "Open the month header dropdown and click a year to filter that calendar year.",
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
                                      {t("digitalMarketing.tiktokAds.metricsButton", "Metrics")}
                                    </Button>
                                  </div>
                                </div>

                                {reportingEnabled && advertiserId ? (
                                  <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-1 [@media(max-height:900px)]:px-3 [@media(max-height:900px)]:pb-2">
                                    <TikTokAdsMetricsSummaryBar
                                      entity={entity}
                                      advertiserId={advertiserId}
                                      summary={
                                        metricsTableLoading ? undefined : metricsQuery.data?.summary
                                      }
                                      rows={sortedRows}
                                      catalogItems={allEntityMetricItems}
                                      metricKeys={summarySlotMetricKeys}
                                      onMetricKeysChange={(keys) => {
                                        setSummarySlotMetricKeys(keys);
                                        saveTikTokAdsSummarySlotMetrics(entity, keys);
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
                                          "digitalMarketing.tiktokAds.activeColumnSet",
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
                                              "digitalMarketing.tiktokAds.chooseColumnSet",
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
                                                TIKTOK_ADS_COLUMN_SET_SELECT_ITEM_CLASS,
                                              )}
                                            >
                                              <TikTokAdsColumnSetOptionLabel set={set} />
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
                                            "digitalMarketing.tiktokAds.error",
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
                                      <TikTokAdsMetricsTable
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

                                    <TikTokAdsMetricsTableFooter
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

      <TikTokAdsModifyColumnsDialog
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
        isSaving={saveMetrics.isPending || saveColumnSet.isPending}
        isDeletingColumnSet={removeColumnSet.isPending}
      />
    </>
  );
}
