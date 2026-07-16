import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleAdsMetricsPageSkeleton, GoogleAdsMetricsPanelSkeleton } from "@/6-0-google-ads/skeletons/GoogleAdsMetricsPageSkeleton";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { cn } from "@/shared/lib/utils";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Columns3, Loader2, RefreshCw } from "lucide-react";
import type { GoogleAdsMetricsRow } from "@/google-ads/metrics/types";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { ModuleHeaderBelowContentGate } from "@/shared/layouts/ModuleHeaderBelowContentGate";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { GoogleAdsCampaignAdGroupFilters } from "@/6-0-google-ads/components/GoogleAdsCampaignAdGroupFilters";
import { GoogleAdsEntityNav } from "@/6-0-google-ads/components/GoogleAdsEntityNav";
import { GoogleAdsDateRangePicker } from "@/6-0-google-ads/components/GoogleAdsDateRangePicker";
import {
  computePresetRange,
  toGoogleAdsMetricsDateRangePayload,
  toYmdLocal,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { buildReportYearOptionsFromEarliest } from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";
import {
  GOOGLE_ADS_OPTIONAL_IDENTITY_COLUMNS,
  isOptionalIdentityColumnKey,
} from "@/google-ads/metrics/googleAdsIdentityColumns";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
import { useOmnichannelSurveySettingsAdmin } from "@/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useGoogleAdsReportingEnabled } from "@/google-ads/hooks/useGoogleAdsReportingEnabled";
import { useGoogleAdsConversionActions } from "@/google-ads/hooks/useGoogleAdsConversionActions";
import { useGoogleAdsUiCustomColumns } from "@/google-ads/hooks/useGoogleAdsUiCustomColumns";
import {
  buildSummaryMetricOptions,
  DEFAULT_SUMMARY_SLOT_KEYS,
  loadSummarySlotMetrics,
  saveSummarySlotMetrics,
} from "@/google-ads/metrics/googleAdsSummaryMetricOptions";
import { useGoogleAdsMetricCatalog } from "@/google-ads/hooks/useGoogleAdsMetricCatalog";
import {
  buildGoogleAdsMetricsQueryKey,
  fetchGoogleAdsMetricsFresh,
  useGoogleAdsMetricsQuery,
} from "@/google-ads/hooks/useGoogleAdsMetricsQuery";
import { useGoogleAdsMetricsPreferences } from "@/google-ads/hooks/useGoogleAdsMetricsPreferences";
import { GoogleAdsModifyColumnsDialog } from "@/6-0-google-ads/components/GoogleAdsModifyColumnsDialog";
import { GoogleAdsTrafficWebIdSelect } from "@/6-0-google-ads/components/GoogleAdsTrafficWebIdSelect";
import { isSynckerjaLeadsMetricKey } from "@/google-ads/metrics/googleAdsSynckerjaLeadsMetrics";
import { isSynckerjaTrafficMetricKey } from "@/google-ads/metrics/googleAdsSynckerjaTrafficMetrics";
import {
  GOOGLE_ADS_COLUMN_SET_SELECT_ITEM_CLASS,
  GoogleAdsColumnSetOptionLabel,
} from "@/google-ads/components/GoogleAdsColumnSetOptionLabel";
import {
  useGoogleAdsColumnSets,
  type GoogleAdsColumnSet,
} from "@/google-ads/hooks/useGoogleAdsColumnSets";
import { GoogleAdsMetricsSummaryBar } from "@/6-0-google-ads/components/GoogleAdsMetricsSummaryBar";
import { GoogleAdsMetricsTable } from "@/6-0-google-ads/components/GoogleAdsMetricsTable";
import { GoogleAdsMetricsTableFooter } from "@/6-0-google-ads/components/GoogleAdsMetricsTableFooter";
import {
  buildSortColumnOptions,
  defaultSortDirectionForKind,
  getSortColumnKind,
  parseStoredSort,
  resolveSortForOptions,
  sortDirectionLabelKeys,
} from "@/google-ads/metrics/googleAdsSortColumns";
import type { GoogleAdsMetricEntity, GoogleAdsMetricsSort } from "@/google-ads/metrics/types";
import { isUnsupportedMetricsError } from "@/google-ads/lib/parseEdgeFunctionError";
import { resolveCampaignFilterIdFromRow } from "@/google-ads/metrics/parseGoogleAdsResourceId";
import { parseTotalRowCount } from "@/google-ads/metrics/parseTotalRowCount";
import { filterUnsupportedMetricsForEntity } from "@/google-ads/metrics/keywordViewExcludedMetrics";
import { useGoogleAdsSettings } from "@/google-ads/hooks/useGoogleAdsSettings";
import {
  resolveCampaignIdFromMetricsRow,
  useGoogleAdsCampaignServiceMapping,
} from "@/google-ads/hooks/useGoogleAdsCampaignServiceMapping";
import { useServices } from "@/6-1-product-knowledge/hooks/useServices";
import { GoogleAdsSettingsPanel } from "@/google-ads/settings/GoogleAdsSettingsPanel";
import {
  GOOGLE_ADS_DIGITAL_MARKETING_BASE_PATH,
  GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH,
} from "@/google-ads/settings/googleAdsSettingsPaths";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "sonner";

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
  columnSets: GoogleAdsColumnSet[],
  keys: string[],
): GoogleAdsColumnSet | null {
  if (keys.length === 0) return null;
  return (
    columnSets.find((set) => columnKeysMatch(set.metric_keys, keys)) ??
    columnSets.find((set) => columnKeysMatchOrderIndependent(set.metric_keys, keys)) ??
    null
  );
}

function parseMetricsPageOffset(token: string): number {
  const s = token.trim();
  if (!s || !/^\d+$/.test(s)) return 0;
  return Math.max(0, Number(s));
}

export default function GoogleAdsMetricsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <GoogleAdsMetricsPageSkeleton />;
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ModuleHeaderBelowContentGate
              pagePath="/digital-marketing/google-ads"
              header={<HeaderAndTab />}
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            >
              <GoogleAdsMetricsPageContent />
            </ModuleHeaderBelowContentGate>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleAdsMetricsPageContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsView = location.pathname === GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH;
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useGoogleAdsReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending, syncAccessibleAccounts } = useGoogleAdsSettings(
    organizationId,
    {
      enabled: canManage && !gatePending,
    },
  );
  const oauthConnected = settings?.oauthConnected ?? false;

  const [entity, setEntity] = useState<GoogleAdsMetricEntity>("campaign");
  const [summarySlotMetricKeys, setSummarySlotMetricKeys] = useState(() =>
    loadSummarySlotMetrics("campaign"),
  );
  const { dateSelection, setDateSelection, googleCustomerId, setGoogleCustomerId } =
    useDigitalMarketingPaidAdsFilters();
  const customerId = googleCustomerId;
  const setCustomerId = setGoogleCustomerId;
  const [onlyRunning, setOnlyRunning] = useState(true);
  const [enabledOnly, setEnabledOnly] = useState(false);

  /** Keywords tab lists all criteria; Delivery filter hides zero-metric rows. */
  useEffect(() => {
    if (entity === "keyword") {
      setOnlyRunning(false);
    }
  }, [entity]);
  const [pageToken, setPageToken] = useState("");
  const [pageTokenHistory, setPageTokenHistory] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<GoogleAdsMetricsSort>({ field: "spent", direction: "desc" });
  const sortHydratedForEntityRef = useRef<string | null>(null);
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const [unsupportedBannerLabels, setUnsupportedBannerLabels] = useState<string[] | null>(
    null,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedAdGroupId, setSelectedAdGroupId] = useState<string | null>(null);
  const [stableTotalRows, setStableTotalRows] = useState<number | null>(null);

  const resetPagination = () => {
    setPageToken("");
    setPageTokenHistory([]);
  };

  const { data: catalogData } = useGoogleAdsMetricCatalog(
    organizationId,
    entity,
    true,
  );

  const { columnSets, save: saveColumnSet, remove: removeColumnSet } = useGoogleAdsColumnSets(
    organizationId,
    entity,
    true,
  );

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

  /** Disabled TanStack query stays `isPending` — only pend while settings/oauth resolve or accounts fetch when connected. */
  const accountsListPending =
    oauthConnected && (accountsPending || (accountsFetching && accountsDataUpdatedAt === 0));
  const accountsNavPending = settingsPending || accountsListPending;

  useEffect(() => {
    if (!oauthConnected && googleCustomerId) {
      setGoogleCustomerId("");
    }
  }, [oauthConnected, googleCustomerId, setGoogleCustomerId]);

  const effectiveCustomerId = useMemo(() => {
    if (customerId) return customerId;
    const def = accounts.find((a) => a.is_default);
    return def?.customer_id ?? accounts[0]?.customer_id ?? "";
  }, [customerId, accounts]);

  const {
    customColumns: uiCustomColumns,
    isLoading: uiCustomColumnsLoading,
    isImporting: uiCustomColumnsImporting,
    importColumns: importUiCustomColumns,
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

  const metricLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of catalogData?.categories ?? []) {
      for (const m of c.metrics) map.set(m.key, m.label);
    }
    for (const m of catalogData?.recommended.metrics ?? []) {
      map.set(m.key, m.label);
    }
    for (const col of uiCustomColumns) {
      map.set(col.key, col.label);
    }
    return map;
  }, [catalogData, uiCustomColumns]);

  const {
    selectedMetrics,
    storedSort,
    save: saveMetrics,
    saveSort,
    isPending: prefsPending,
  } = useGoogleAdsMetricsPreferences(organizationId, entity, validMetricKeys);

  const customerSelectReady =
    !accountsNavPending && accounts.length > 0 && Boolean(effectiveCustomerId);

  const { data: accountDateBounds } = useGoogleAdsAccountDateBounds(
    organizationId,
    effectiveCustomerId,
    canManage && reportingEnabled && Boolean(effectiveCustomerId),
  );

  /** When account bounds load, refresh all_time range only — do not reset preset to last_30_days. */
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
  }, [accountDateBounds?.earliest_date]);

  const calendarYearPresetYears = useMemo(
    () => buildReportYearOptionsFromEarliest(accountDateBounds?.earliest_date),
    [accountDateBounds?.earliest_date],
  );

  const dateRangePayload = useMemo(
    () => toGoogleAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );

  useEffect(() => {
    setUnsupportedBannerLabels(null);
  }, [entity, effectiveCustomerId]);

  useEffect(() => {
    setSelectedCampaignId(null);
    setSelectedAdGroupId(null);
    resetPagination();
  }, [effectiveCustomerId]);

  useEffect(() => {
    if (entity === "campaign") {
      setSelectedAdGroupId(null);
    }
  }, [entity]);

  useEffect(() => {
    setSummarySlotMetricKeys(loadSummarySlotMetrics(entity));
  }, [entity]);

  const { data: conversionActions = [] } = useGoogleAdsConversionActions(
    organizationId,
    effectiveCustomerId,
    canManage && reportingEnabled && Boolean(effectiveCustomerId),
  );

  const summaryMetricOptions = useMemo(
    () => buildSummaryMetricOptions(entity, catalogData, conversionActions),
    [entity, catalogData, conversionActions],
  );

  const handleSummarySlotMetricChange = (slotIndex: number, key: string) => {
    setSummarySlotMetricKeys((prev) => {
      const next = [...prev];
      next[slotIndex] = key;
      saveSummarySlotMetrics(entity, next);
      return next;
    });
  };

  useEffect(() => {
    if (summaryMetricOptions.length === 0) return;
    setSummarySlotMetricKeys((prev) => {
      let changed = false;
      const next = prev.map((key, i) => {
        const normalized = key === "spent" ? (DEFAULT_SUMMARY_SLOT_KEYS[i] ?? "impressions") : key;
        if (summaryMetricOptions.some((o) => o.key === normalized)) {
          if (normalized !== key) changed = true;
          return normalized;
        }
        changed = true;
        return DEFAULT_SUMMARY_SLOT_KEYS[i] ?? "impressions";
      });
      return changed ? next : prev;
    });
  }, [summaryMetricOptions]);

  const selectedMetricsForEntity = useMemo(() => {
    if (!validMetricKeys) return selectedMetrics;
    return selectedMetrics.filter(
      (k) =>
        validMetricKeys.has(k) ||
        k.startsWith("conv_action:") ||
        k.startsWith("ui_custom:") ||
        isOptionalIdentityColumnKey(entity, k) ||
        isSynckerjaTrafficMetricKey(k) ||
        isSynckerjaLeadsMetricKey(k),
    );
  }, [selectedMetrics, validMetricKeys, entity]);

  const apiMetricKeys = useMemo(
    () => selectedMetricsForEntity.filter((k) => !isOptionalIdentityColumnKey(entity, k)),
    [selectedMetricsForEntity, entity],
  );

  const metricItems = useMemo(() => {
    const cats = catalogData?.categories ?? [];
    const map = new Map<string, (typeof cats)[0]["metrics"][0]>();
    for (const m of catalogData?.recommended.metrics ?? []) {
      map.set(m.key, m);
    }
    for (const c of cats) {
      for (const m of c.metrics) map.set(m.key, m);
    }
    return selectedMetricsForEntity
      .map((k) => {
        const catalogMetric = map.get(k);
        if (catalogMetric) return catalogMetric;
        const uiCustom = uiCustomColumnByKey.get(k);
        if (!uiCustom) return null;
        return {
          key: uiCustom.key,
          label: uiCustom.label,
          description: uiCustom.description,
          entities: ["campaign", "ad_group", "ad", "keyword"] as const,
          valueKind: "count" as const,
          defaultSelected: false,
          sortable: false,
        };
      })
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
  }, [catalogData, uiCustomColumnByKey, selectedMetricsForEntity]);

  const matchedColumnSet = useMemo(
    () => findMatchingColumnSet(columnSets, selectedMetricsForEntity),
    [columnSets, selectedMetricsForEntity],
  );

  const sortColumnOptions = useMemo(
    () => buildSortColumnOptions(entity, selectedMetricsForEntity, metricItems),
    [entity, selectedMetricsForEntity, metricItems],
  );

  const sortFieldValue = useMemo(() => {
    if (sortColumnOptions.some((o) => o.key === sort.field)) return sort.field;
    return sortColumnOptions[0]?.key ?? sort.field;
  }, [sort.field, sortColumnOptions]);

  const sortKind = useMemo(
    () => getSortColumnKind(sortFieldValue, entity, metricItems),
    [sortFieldValue, entity, metricItems],
  );

  const sortDirectionLabels = useMemo(() => {
    const keys = sortDirectionLabelKeys(sortKind);
    return {
      desc: t(keys.descKey, keys.descDefault),
      asc: t(keys.ascKey, keys.ascDefault),
    };
  }, [sortKind, t]);

  useEffect(() => {
    sortHydratedForEntityRef.current = null;
  }, [entity, organizationId]);

  useEffect(() => {
    if (prefsPending || sortColumnOptions.length === 0) return;
    if (sortHydratedForEntityRef.current === entity) return;
    sortHydratedForEntityRef.current = entity;
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
  }, [sortColumnOptions, entity, metricItems]);

  const handleSortFieldChange = (field: string) => {
    const kind = getSortColumnKind(field, entity, metricItems);
    const next: GoogleAdsMetricsSort = {
      field,
      direction: defaultSortDirectionForKind(kind),
    };
    setSort(next);
    resetPagination();
    void saveSort.mutateAsync(next);
  };

  const handleSortDirectionChange = (direction: "asc" | "desc") => {
    const next: GoogleAdsMetricsSort = { field: sortFieldValue, direction };
    setSort(next);
    resetPagination();
    void saveSort.mutateAsync(next);
  };

  const statusFilter = enabledOnly ? ("enabled_only" as const) : ("all" as const);

  useEffect(() => {
    if (!validMetricKeys || prefsPending) return;
    const pruned = selectedMetrics.filter((k) => validMetricKeys.has(k));
    if (pruned.length === selectedMetrics.length) return;
    if (pruned.length === 0) return;
    void saveMetrics.mutateAsync(pruned);
  }, [entity, validMetricKeys, selectedMetrics, prefsPending, saveMetrics]);

  const metricsFilters = useMemo(() => {
    if (!effectiveCustomerId || apiMetricKeys.length === 0) return null;
    return {
      customerId: effectiveCustomerId,
      entity,
      metrics: apiMetricKeys,
      dateRange: dateRangePayload,
      onlyRunning,
      statusFilter,
      pageToken,
      pageSize,
      sort,
      campaignFilterId: selectedCampaignId ?? undefined,
      adGroupFilterId:
        selectedAdGroupId && entity !== "campaign" ? selectedAdGroupId : undefined,
      summaryMetrics: summarySlotMetricKeys,
    };
  }, [
    effectiveCustomerId,
    entity,
    apiMetricKeys,
    dateRangePayload,
    onlyRunning,
    statusFilter,
    pageToken,
    pageSize,
    sort,
    selectedCampaignId,
    selectedAdGroupId,
    summarySlotMetricKeys,
  ]);

  const handleCampaignDrillDown = (row: GoogleAdsMetricsRow) => {
    if (!effectiveCustomerId) return;
    const filterId = resolveCampaignFilterIdFromRow(row, effectiveCustomerId);
    if (!filterId) return;
    setSelectedCampaignId(filterId);
    setSelectedAdGroupId(null);
    setEntity("ad_group");
    resetPagination();
  };

  const { data: orgServices = [] } = useServices();
  const serviceMappingMutation = useGoogleAdsCampaignServiceMapping();

  const handleServiceMappingChange = async (
    row: GoogleAdsMetricsRow,
    serviceId: string | null,
  ) => {
    if (!organizationId || !effectiveCustomerId) return;
    const campaignId = resolveCampaignIdFromMetricsRow(row, effectiveCustomerId);
    if (!campaignId) {
      toast.error(
        t("digitalMarketing.googleAds.serviceMappingCampaignError", "Tidak dapat mengenali campaign."),
      );
      return;
    }
    try {
      await serviceMappingMutation.mutateAsync({
        organizationId,
        customerId: effectiveCustomerId,
        campaignId,
        serviceId,
      });
      toast.success(
        t("digitalMarketing.googleAds.serviceMappingSaved", "Mapping service disimpan."),
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("digitalMarketing.googleAds.serviceMappingFailed", "Gagal menyimpan mapping."),
      );
    }
  };

  const metricsQuery = useGoogleAdsMetricsQuery(
    organizationId,
    metricsFilters,
    canManage && reportingEnabled && !prefsPending,
  );

  /** Hide stale rows while sort, page, or report level changes during fetch. */
  const committedMetricsFetchRef = useRef({
    sortField: sort.field,
    sortDirection: sort.direction,
    pageToken,
    entity,
  });
  const metricsTableRows = useMemo(() => {
    const rows = metricsQuery.data?.rows ?? [];
    if (!metricsQuery.isFetching) {
      committedMetricsFetchRef.current = {
        sortField: sort.field,
        sortDirection: sort.direction,
        pageToken,
        entity,
      };
      return rows;
    }
    const committed = committedMetricsFetchRef.current;
    if (
      committed.entity !== entity ||
      committed.sortField !== sort.field ||
      committed.sortDirection !== sort.direction ||
      committed.pageToken !== pageToken
    ) {
      return [];
    }
    return rows;
  }, [
    metricsQuery.data?.rows,
    metricsQuery.isFetching,
    entity,
    sort.field,
    sort.direction,
    pageToken,
  ]);

  const metricsTableLoading =
    Boolean(metricsFilters) &&
    !metricsQuery.isError &&
    (metricsQuery.isFetching || metricsQuery.isPending);

  const metricsTotalKey = useMemo(
    () =>
      JSON.stringify({
        organizationId,
        customerId: effectiveCustomerId,
        entity,
        dateRange: dateRangePayload,
        onlyRunning,
        statusFilter,
        selectedCampaignId,
        selectedAdGroupId,
        metrics: apiMetricKeys,
      }),
    [
      organizationId,
      effectiveCustomerId,
      entity,
      dateRangePayload,
      onlyRunning,
      statusFilter,
      selectedCampaignId,
      selectedAdGroupId,
      apiMetricKeys,
    ],
  );

  useEffect(() => {
    setStableTotalRows(null);
  }, [metricsTotalKey]);

  const pageOffset = useMemo(() => parseMetricsPageOffset(pageToken), [pageToken]);
  const tableRowCount = metricsQuery.data?.rows.length ?? 0;

  useEffect(() => {
    const parsed = parseTotalRowCount(metricsQuery.data?.total_row_count);
    if (parsed == null) return;
    if (parsed === 0 && tableRowCount > 0) return;
    setStableTotalRows(parsed);
  }, [metricsQuery.data?.total_row_count, tableRowCount]);

  const apiTotalRows = parseTotalRowCount(metricsQuery.data?.total_row_count);
  const resolvedTotalRows = useMemo(() => {
    if (stableTotalRows != null && (stableTotalRows > 0 || tableRowCount === 0)) {
      return stableTotalRows;
    }
    if (apiTotalRows != null && apiTotalRows > 0) return apiTotalRows;
    if (tableRowCount === 0) return 0;
    if (!metricsQuery.data?.next_page_token) return pageOffset + tableRowCount;
    return null;
  }, [
    stableTotalRows,
    apiTotalRows,
    tableRowCount,
    metricsQuery.data?.next_page_token,
    pageOffset,
  ]);

  const tableHasNextPageFromToken = Boolean(metricsQuery.data?.next_page_token);
  const tableTotalCount = resolvedTotalRows ?? 0;
  const tableTotalCountKnown = resolvedTotalRows != null && resolvedTotalRows > 0;
  const tableRangeFrom = tableRowCount === 0 ? 0 : pageOffset + 1;
  const tableRangeTo = pageOffset + tableRowCount;
  const tableLastPageOffset = useMemo(() => {
    if (!tableTotalCountKnown || tableTotalCount <= 0) return 0;
    return Math.max(0, Math.floor((tableTotalCount - 1) / pageSize) * pageSize);
  }, [tableTotalCount, tableTotalCountKnown, pageSize]);
  const tableHasPreviousPage = pageOffset > 0;
  const tableHasNextPage =
    tableRowCount > 0 &&
    (tableTotalCountKnown
      ? pageOffset + pageSize < tableTotalCount
      : tableHasNextPageFromToken);
  const tableHasLastPage =
    tableTotalCountKnown && tableTotalCount > pageSize && pageOffset < tableLastPageOffset;

  const goToLastTablePage = () => {
    if (!tableTotalCountKnown || tableLastPageOffset <= 0) {
      resetPagination();
      return;
    }
    const history: string[] = [];
    for (let offset = 0; offset < tableLastPageOffset; offset += pageSize) {
      history.push(String(offset));
    }
    setPageTokenHistory(history);
    setPageToken(String(tableLastPageOffset));
  };

  const handleSwitchColumnSet = async (setId: string) => {
    if (matchedColumnSet?.id === setId) return;
    const set = columnSets.find((s) => s.id === setId);
    if (!set) return;
    const keys = set.metric_keys.filter(
      (k) =>
        validMetricKeys?.has(k) ||
        k.startsWith("conv_action:") ||
        k.startsWith("ui_custom:") ||
        isOptionalIdentityColumnKey(entity, k) ||
        isSynckerjaTrafficMetricKey(k) ||
        isSynckerjaLeadsMetricKey(k),
    );
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
  };

  const handleApplyMetrics = async (
    keys: string[],
    options?: { saveColumnSetName?: string },
  ) => {
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
          entities: ["campaign", "ad_group", "ad", "keyword"],
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
      if (options?.saveColumnSetName) {
        await saveColumnSet.mutateAsync({
          name: options.saveColumnSetName,
          metric_keys: keys,
        });
        toast.success("Column set saved");
      }
      resetPagination();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  useEffect(() => {
    const skipped = filterUnsupportedMetricsForEntity(
      entity,
      metricsQuery.data?.unsupported_metrics?.filter((k) => validMetricKeys?.has(k)),
    );
    if (skipped.length > 0) {
      setUnsupportedBannerLabels(skipped.map((k) => metricLabelByKey.get(k) ?? k));
      return;
    }
    setUnsupportedBannerLabels(null);
  }, [
    entity,
    metricsQuery.data?.unsupported_metrics,
    metricsQuery.error,
    metricLabelByKey,
    validMetricKeys,
  ]);

  const handleRefresh = async () => {
    if (!organizationId || !metricsFilters) return;
    setIsRefreshing(true);
    resetPagination();
    try {
      try {
        const result = await syncAccessibleAccounts.mutateAsync();
        const imported = result.imported ?? 0;
        if (imported > 0) {
          toast.success(
            t("digitalMarketing.googleAds.syncImported", {
              defaultValue: "Imported {{count}} account(s) from Google.",
              count: imported,
            }),
          );
        }
      } catch (syncErr) {
        toast.error((syncErr as Error).message);
      }

      await queryClient.invalidateQueries({
        queryKey: ["google-ads-accounts-picker-metrics", organizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["google-ads-campaign-list", organizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["google-ads-ad-group-list", organizationId],
      });

      const refreshFilters = { ...metricsFilters, pageToken: "" };
      const fresh = await fetchGoogleAdsMetricsFresh(organizationId, refreshFilters);
      const queryKey = buildGoogleAdsMetricsQueryKey(organizationId, refreshFilters);
      queryClient.setQueryData(queryKey, fresh);
      await queryClient.invalidateQueries({
        queryKey: ["google-ads-metrics-v2", organizationId],
        refetchType: "none",
      });
    } catch (e) {
      toast.error((e as Error).message);
      await metricsQuery.refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const err = metricsQuery.error as (Error & { code?: string }) | null;
  const showTokenDenied =
    err?.code === "DEVELOPER_TOKEN_NOT_APPROVED" ||
    /DEVELOPER_TOKEN_NOT_APPROVED/i.test(err?.message ?? "") ||
    /developer token.*test account|only approved for use with test/i.test(err?.message ?? "");
  const showReconnectOAuth =
    err?.code === "TOKEN_REFRESH_FAILED" ||
    /invalid_grant|token refresh|TOKEN_REFRESH/i.test(err?.message ?? "");

  const accountsInitialPending =
    Boolean(organizationId) &&
    canManage &&
    reportingEnabled &&
    oauthConnected &&
    (accountsPending || (accountsFetching && accountsDataUpdatedAt === 0));

  const metricsPanelReady =
    Boolean(organizationId) &&
    canManage &&
    reportingEnabled &&
    Boolean(effectiveCustomerId) &&
    Boolean(metricsFilters) &&
    !prefsPending;

  const metricsInitialPending =
    metricsPanelReady &&
    (metricsQuery.isPending ||
      (metricsQuery.isFetching && metricsQuery.dataUpdatedAt === 0));

  const rawPageLoadPending = isSettingsView
    ? orgBootstrapPending || gatePending || (canManage && settingsPending)
    : orgBootstrapPending ||
      gatePending ||
      (Boolean(organizationId) && canManage && reportingPending) ||
      (Boolean(organizationId) && canManage && reportingEnabled && prefsPending) ||
      accountsInitialPending ||
      metricsInitialPending;

  const [showPageSkeletonOverlay, setShowPageSkeletonOverlay] = useState(true);
  const revealRafOuterRef = useRef<number | null>(null);
  const revealRafInnerRef = useRef<number | null>(null);
  const hideOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setShowPageSkeletonOverlay(true);
  }, [organizationId, effectiveCustomerId]);

  useEffect(() => {
    if (rawPageLoadPending) {
      if (revealRafOuterRef.current != null) {
        cancelAnimationFrame(revealRafOuterRef.current);
        revealRafOuterRef.current = null;
      }
      if (revealRafInnerRef.current != null) {
        cancelAnimationFrame(revealRafInnerRef.current);
        revealRafInnerRef.current = null;
      }
      if (hideOverlayTimeoutRef.current != null) {
        clearTimeout(hideOverlayTimeoutRef.current);
        hideOverlayTimeoutRef.current = null;
      }
      setShowPageSkeletonOverlay(true);
      return;
    }

    hideOverlayTimeoutRef.current = setTimeout(() => {
      hideOverlayTimeoutRef.current = null;
      revealRafOuterRef.current = requestAnimationFrame(() => {
        revealRafInnerRef.current = requestAnimationFrame(() => {
          revealRafOuterRef.current = null;
          revealRafInnerRef.current = null;
          setShowPageSkeletonOverlay(false);
        });
      });
    }, 200);

    return () => {
      if (hideOverlayTimeoutRef.current != null) {
        clearTimeout(hideOverlayTimeoutRef.current);
        hideOverlayTimeoutRef.current = null;
      }
      if (revealRafOuterRef.current != null) {
        cancelAnimationFrame(revealRafOuterRef.current);
        revealRafOuterRef.current = null;
      }
      if (revealRafInnerRef.current != null) {
        cancelAnimationFrame(revealRafInnerRef.current);
        revealRafInnerRef.current = null;
      }
    };
  }, [rawPageLoadPending]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          showPageSkeletonOverlay && "pointer-events-none opacity-0",
        )}
        aria-hidden={showPageSkeletonOverlay}
      >
        <div className="grid min-h-0 min-w-0 w-full flex-1 basis-0 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                      {!canManage ? (
                        <div className="p-6">
                          <Alert>
                            <AlertTitle>
                              {t("digitalMarketing.googleAds.accessDeniedTitle", "Access restricted")}
                            </AlertTitle>
                            <AlertDescription>
                              {t(
                                "digitalMarketing.googleAds.accessDeniedBody",
                                "Only the organization owner or an omnichannel admin can view Google Ads metrics.",
                              )}{" "}
                              <Link
                                to={GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                className="font-medium text-primary underline"
                              >
                                {t("digitalMarketing.googleAds.settingsLink", "Google Ads settings")}
                              </Link>
                            </AlertDescription>
                          </Alert>
                        </div>
                      ) : (
                        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
                          <GoogleAdsEntityNav
                            entity={entity}
                            onEntityChange={(next) => {
                              setEntity(next);
                              resetPagination();
                              if (isSettingsView) {
                                navigate(GOOGLE_ADS_DIGITAL_MARKETING_BASE_PATH);
                              }
                            }}
                            accounts={accounts}
                            customerId={effectiveCustomerId}
                            customerSelectReady={customerSelectReady}
                            accountsPending={accountsNavPending}
                            onCustomerIdChange={setCustomerId}
                            settingsActive={isSettingsView}
                            onSettingsSelect={() => navigate(GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH)}
                          />
                          <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                          {isSettingsView ? (
                            <GoogleAdsSettingsPanel
                              organizationId={organizationId}
                              enabled={canManage && !gatePending}
                              oauthReturnPath={GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                              contentClassName="p-4"
                            />
                          ) : (
                          <>
                          <div className="shrink-0 space-y-3 border-b border-gray-200 p-4 [@media(max-height:900px)]:space-y-2 [@media(max-height:900px)]:p-3">

                            {!reportingPending && !reportingEnabled ? (
                              <Alert>
                                <AlertTitle>
                                  {t("digitalMarketing.googleAds.notConnectedTitle", "Not connected")}
                                </AlertTitle>
                                <AlertDescription>
                                  {t(
                                    "digitalMarketing.googleAds.notConnectedBody",
                                    "Connect Google Ads and add at least one customer account.",
                                  )}{" "}
                                  <Link
                                    to={GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                    className="font-medium text-primary underline"
                                  >
                                    {t("digitalMarketing.googleAds.settingsLink", "Settings")}
                                  </Link>
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            {showTokenDenied ? (
                              <Alert variant="destructive">
                                <AlertTitle>
                                  {t(
                                    "digitalMarketing.googleAds.tokenNotApprovedTitle",
                                    "Developer token not approved",
                                  )}
                                </AlertTitle>
                                <AlertDescription>
                                  {t(
                                    "digitalMarketing.googleAds.tokenNotApprovedBody",
                                    "Your Google Ads API developer token is approved for test accounts only. Apply for Basic or Standard access to use production accounts.",
                                  )}{" "}
                                  <a
                                    href="https://ads.google.com/aw/apicenter"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-primary underline"
                                  >
                                    {t("digitalMarketing.googleAds.apiCenterLink", "API Center")}
                                  </a>
                                  {" · "}
                                  <Link
                                    to={GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                    className="font-medium text-primary underline"
                                  >
                                    {t("digitalMarketing.googleAds.settingsLink", "Settings")}
                                  </Link>
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            {unsupportedBannerLabels && unsupportedBannerLabels.length > 0 ? (
                              <Alert>
                                <AlertTitle>
                                  {t(
                                    "digitalMarketing.googleAds.unsupportedMetricsTitle",
                                    "Metrics adjusted",
                                  )}
                                </AlertTitle>
                                <AlertDescription>
                                  {t(
                                    "digitalMarketing.googleAds.unsupportedMetricsBody",
                                    "These metrics are not supported for the current tab or account and were removed:",
                                  )}{" "}
                                  {unsupportedBannerLabels.join(", ")}
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            {showReconnectOAuth ? (
                              <Alert variant="destructive">
                                <AlertTitle>
                                  {t(
                                    "digitalMarketing.googleAds.oauthExpiredTitle",
                                    "Google Ads connection expired",
                                  )}
                                </AlertTitle>
                                <AlertDescription>
                                  {t(
                                    "digitalMarketing.googleAds.oauthExpiredBody",
                                    "Reconnect Google Ads in settings to refresh access.",
                                  )}{" "}
                                  <Link
                                    to={GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                    className="font-medium text-primary underline"
                                  >
                                    {t("digitalMarketing.googleAds.settingsLink", "Settings")}
                                  </Link>
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            <div className="flex min-w-0 flex-col gap-2">
                              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                {reportingEnabled && effectiveCustomerId ? (
                                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                    <GoogleAdsCampaignAdGroupFilters
                                      organizationId={organizationId}
                                      customerId={effectiveCustomerId}
                                      entity={entity}
                                      statusFilter={statusFilter}
                                      reportingEnabled={reportingEnabled}
                                      selectedCampaignId={selectedCampaignId}
                                      selectedAdGroupId={selectedAdGroupId}
                                      disabled={!metricsFilters || metricsQuery.isFetching}
                                      onCampaignChange={(id) => {
                                        setSelectedCampaignId(id);
                                        setSelectedAdGroupId(null);
                                        resetPagination();
                                      }}
                                      onAdGroupChange={(id) => {
                                        setSelectedAdGroupId(id);
                                        resetPagination();
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="min-w-0 flex-1" aria-hidden />
                                )}

                                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    title={t(
                                      "digitalMarketing.googleAds.refreshData",
                                      "Refresh accounts and metrics from Google",
                                    )}
                                    disabled={
                                      !reportingEnabled ||
                                      isRefreshing ||
                                      syncAccessibleAccounts.isPending ||
                                      !metricsFilters
                                    }
                                    onClick={() => void handleRefresh()}
                                  >
                                    {isRefreshing || syncAccessibleAccounts.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>

                                  {entity === "campaign" ? (
                                    <GoogleAdsTrafficWebIdSelect
                                      organizationId={organizationId}
                                      disabled={!reportingEnabled}
                                      onChanged={() => {
                                        resetPagination();
                                        void metricsQuery.refetch();
                                      }}
                                    />
                                  ) : null}

                                  <GoogleAdsDateRangePicker
                                    value={dateSelection}
                                    accountEarliestYmd={accountDateBounds?.earliest_date}
                                    calendarYearPresetYears={calendarYearPresetYears}
                                    calendarYearFilterHint={t(
                                      "digitalMarketing.googleAds.calendarYearFilterHint",
                                      "Open the month header dropdown and click a year (e.g. 2023) to filter that calendar year.",
                                    )}
                                    onChange={(next) => {
                                      setDateSelection(next);
                                      resetPagination();
                                    }}
                                  />

                                  <Label className="sr-only">
                                    {t("digitalMarketing.googleAds.sortBy", "Sort by")}
                                  </Label>
                                  <Select
                                    value={sortFieldValue}
                                    onValueChange={handleSortFieldChange}
                                    disabled={sortColumnOptions.length === 0}
                                  >
                                    <SelectTrigger className="h-9 w-[min(140px,28vw)]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sortColumnOptions.map((o) => (
                                        <SelectItem key={o.key} value={o.key}>
                                          {o.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={sort.direction}
                                    onValueChange={(v) =>
                                      handleSortDirectionChange(v as "asc" | "desc")
                                    }
                                  >
                                    <SelectTrigger className="h-9 w-[116px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="desc">
                                        {sortDirectionLabels.desc}
                                      </SelectItem>
                                      <SelectItem value="asc">
                                        {sortDirectionLabels.asc}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <Switch
                                      id="only-running"
                                      className="scale-90"
                                      checked={onlyRunning}
                                      onCheckedChange={(c) => {
                                        setOnlyRunning(c);
                                        resetPagination();
                                      }}
                                    />
                                    <Label
                                      htmlFor="only-running"
                                      className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground"
                                      title={t(
                                        "digitalMarketing.googleAds.onlyRunning",
                                        "Only keywords/rows with impressions or cost in this date range. Off = closer to Google Ads row count.",
                                      )}
                                    >
                                      {t("digitalMarketing.googleAds.onlyRunningShort", "Delivery")}
                                    </Label>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <Switch
                                      id="enabled-only"
                                      className="scale-90"
                                      checked={enabledOnly}
                                      onCheckedChange={(c) => {
                                        setEnabledOnly(c);
                                        resetPagination();
                                      }}
                                    />
                                    <Label
                                      htmlFor="enabled-only"
                                      className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground"
                                      title={t(
                                        "digitalMarketing.googleAds.enabledOnly",
                                        "Enabled status only",
                                      )}
                                    >
                                      {t("digitalMarketing.googleAds.enabledOnlyShort", "Enabled")}
                                    </Label>
                                  </div>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 shrink-0"
                                    onClick={() => setMetricsDialogOpen(true)}
                                    disabled={!reportingEnabled}
                                  >
                                    <Columns3 className="mr-2 h-4 w-4" />
                                    {t("digitalMarketing.googleAds.metricsButton", "Metrics")}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {reportingEnabled && effectiveCustomerId ? (
                            <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-1 [@media(max-height:900px)]:px-3 [@media(max-height:900px)]:pb-2">
                              <GoogleAdsMetricsSummaryBar
                                customerId={effectiveCustomerId}
                                totals={
                                  metricsTableLoading
                                    ? undefined
                                    : metricsQuery.data?.summary_totals
                                }
                                currencyCode={metricsQuery.data?.currency_code ?? null}
                                isLoading={metricsTableLoading}
                                metricKeys={summarySlotMetricKeys}
                                onMetricKeyChange={handleSummarySlotMetricChange}
                                summaryMetricOptions={summaryMetricOptions}
                              />
                            </div>
                          ) : null}

                          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-gray-100">
                            {columnSets.length > 0 ? (
                              <div className="flex shrink-0 items-center gap-2 px-4 py-2 [@media(max-height:900px)]:px-3 [@media(max-height:900px)]:py-1.5">
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {t(
                                    "digitalMarketing.googleAds.activeColumnSet",
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
                                        "digitalMarketing.googleAds.chooseColumnSet",
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
                                          GOOGLE_ADS_COLUMN_SET_SELECT_ITEM_CLASS,
                                        )}
                                      >
                                        <GoogleAdsColumnSetOptionLabel set={set} />
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : null}

                            {metricsQuery.isError &&
                            !showTokenDenied &&
                            !showReconnectOAuth &&
                            !isUnsupportedMetricsError(metricsQuery.error) ? (
                              <div className="shrink-0 px-4 pb-2">
                                <Alert variant="destructive">
                                  <AlertDescription>
                                    {(metricsQuery.error as Error).message}
                                  </AlertDescription>
                                </Alert>
                              </div>
                            ) : null}

                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4">
                              <div className="min-h-0 flex-1 overflow-hidden">
                                <GoogleAdsMetricsTable
                                  entity={entity}
                                  rows={metricsTableRows}
                                  selectedColumnKeys={selectedMetricsForEntity}
                                  metricItems={metricItems}
                                  currencyCode={metricsQuery.data?.currency_code ?? null}
                                  isLoading={metricsTableLoading}
                                  canEditServiceMapping={
                                    entity === "campaign" && canManage
                                  }
                                  organizationId={organizationId}
                                  customerId={effectiveCustomerId}
                                  services={orgServices.map((s) => ({
                                    id: s.id,
                                    name: s.name,
                                  }))}
                                  onServiceMappingChange={
                                    entity === "campaign" ? handleServiceMappingChange : undefined
                                  }
                                  serviceMappingPending={serviceMappingMutation.isPending}
                                  onCampaignDrillDown={
                                    entity === "campaign" ? handleCampaignDrillDown : undefined
                                  }
                                  emptyMessage={
                                    selectedCampaignId && entity === "ad_group"
                                      ? t(
                                          "digitalMarketing.googleAds.noAdGroupsForCampaign",
                                          "No ad groups match your filters for this campaign and date range.",
                                        )
                                      : selectedCampaignId && entity === "keyword"
                                        ? t(
                                            "digitalMarketing.googleAds.noKeywordsForCampaign",
                                            "No keywords match your filters for this campaign and date range.",
                                          )
                                        : selectedAdGroupId
                                          ? t(
                                              "digitalMarketing.googleAds.noRowsForAdGroup",
                                              "No rows match your filters for this ad group and date range.",
                                            )
                                          : entity === "keyword"
                                            ? t(
                                                "digitalMarketing.googleAds.noKeywords",
                                                "No keywords match your filters for this date range.",
                                              )
                                            : undefined
                                  }
                                />
                              </div>

                              <GoogleAdsMetricsTableFooter
                                pageSize={pageSize}
                                onPageSizeChange={(size) => {
                                  setPageSize(size);
                                  resetPagination();
                                }}
                                rangeFrom={tableRangeFrom}
                                rangeTo={tableRangeTo}
                                totalCount={tableTotalCount}
                                hasPreviousPage={tableHasPreviousPage}
                                hasNextPage={tableHasNextPage}
                                hasLastPage={tableHasLastPage}
                                isLoading={metricsQuery.isFetching}
                                onFirstPage={resetPagination}
                                onPreviousPage={() => {
                                  setPageTokenHistory((h) => {
                                    if (h.length === 0) return h;
                                    const prev = h[h.length - 1] ?? "";
                                    setPageToken(prev);
                                    return h.slice(0, -1);
                                  });
                                }}
                                onNextPage={() => {
                                  const next = metricsQuery.data?.next_page_token;
                                  if (!next) return;
                                  setPageTokenHistory((h) => [...h, pageToken]);
                                  setPageToken(next);
                                }}
                                onLastPage={goToLastTablePage}
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

      {showPageSkeletonOverlay ? (
        <div
          className="absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden bg-gray-100"
          aria-busy
          aria-label={t("common.loading", "Loading")}
        >
          <GoogleAdsMetricsPanelSkeleton />
        </div>
      ) : null}

      <GoogleAdsModifyColumnsDialog
        open={metricsDialogOpen}
        onOpenChange={setMetricsDialogOpen}
        entity={entity}
        catalog={catalogData}
        uiCustomColumns={uiCustomColumns}
        uiCustomColumnsLoading={uiCustomColumnsLoading}
        onImportUiCustomColumns={async (names, replaceAll) => {
          try {
            const res = await importUiCustomColumns.mutateAsync({ names, replaceAll });
            toast.success(`Imported ${res.imported_count ?? names.length} custom columns`);
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
        isImportingUiCustomColumns={uiCustomColumnsImporting}
        selectedKeys={selectedMetrics}
        columnSets={columnSets}
        onApply={handleApplyMetrics}
        onDeleteColumnSet={async (id) => {
          try {
            const target = columnSets.find((s) => s.id === id);
            if (target?.scope === "global") return;
            await removeColumnSet.mutateAsync({ id });
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
              await removeColumnSet.mutateAsync({ id });
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
    </div>
  );
}
