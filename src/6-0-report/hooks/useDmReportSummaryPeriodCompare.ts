import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { resolvePreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import type { PreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import { computeKpiCompareDelta, formatCompareDateRange } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";
import { resolveReportGoogleDateRangePayload } from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
import { useGoogleAdsReportingEnabled } from "@/google-ads/hooks/useGoogleAdsReportingEnabled";
import {
  fetchGoogleAdsMetrics,
  type GoogleAdsMetricsFilters,
} from "@/google-ads/hooks/useGoogleAdsMetricsQuery";
import {
  mapReportByServiceApiRows,
  type ReportByServiceApiRow,
} from "@/google-ads/metrics/aggregateCampaignMetricsByService";
import {
  mapMetaReportByServiceApiRows,
  type MetaReportByServiceApiRow,
} from "@/meta-ads/metrics/aggregateMetaCampaignMetricsByService";
import { googleAdsAccountsReportQueryKey } from "@/6-0-digital-marketing-shared/reportQueryKeys";
import { parseEdgeFunctionError as parseGoogleEdgeError } from "@/google-ads/lib/parseEdgeFunctionError";
import { parseEdgeFunctionError as parseMetaEdgeError } from "@/meta-ads/lib/parseEdgeFunctionError";
import { useMetaAdsReportingEnabled } from "@/meta-ads/hooks/useMetaAdsReportingEnabled";
import { fetchMetaAdsMetrics } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import { normalizeMetaAdsReportCurrency } from "@/meta-ads/lib/metaAdsReportCurrency";
import { metaAdsAllTimeDateRange } from "@/meta-ads/lib/clampMetaAdsDateRange";
import { normalizeReportDisplayCurrency } from "@/6-0-digital-marketing-shared/reportDisplayCurrency";
import { useTikTokAdsReportingEnabled } from "@/tiktok-ads/hooks/useTikTokAdsReportingEnabled";
import { fetchTikTokAdsMetrics } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import { useTikTokAdsSettings } from "@/tiktok-ads/hooks/useTikTokAdsSettings";
import { tiktokAdsAllTimeDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import {
  mapTikTokReportByServiceApiRows,
  type TikTokReportByServiceApiRow,
} from "@/tiktok-ads/metrics/aggregateTikTokCampaignMetricsByService";
import { parseEdgeFunctionError as parseTikTokEdgeError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type {
  ReportChannelCost,
  ReportGoogleServiceRow,
  ReportMetaServiceRow,
  ReportTikTokServiceRow,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import {
  aggregateReportChannelCosts,
  aggregateReportTableMetrics,
  formatReportSummaryMetricValue,
  reportCompareToneKey,
  reportSummaryNumericValue,
  type ReportSummaryTotals,
  type ReportTableMetricKey,
} from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import {
  reportRowMatchesServiceFilter,
  type ReportServiceFilterValue,
} from "@/6-0-digital-marketing-shared/reportServiceFilter";

const COMPARE_STALE_TIME = 60_000;

const GOOGLE_REPORT_SUMMARY_METRICS = [
  "spent",
  "avg_cpc",
  "cost_per_conv",
  "conversions",
  "impressions",
  "ctr",
  "clicks",
] as const;

type GoogleSummaryTotals = {
  spent?: number;
  impressions?: number;
  clicks?: number;
  by_key?: Record<string, number | null>;
};

function readGoogleSummaryMetric(
  totals: GoogleSummaryTotals | null | undefined,
  key: "spent" | "impressions" | "clicks",
): number | null {
  if (!totals) return null;
  const fromKey =
    totals.by_key && key in totals.by_key ? totals.by_key[key] : totals[key];
  if (fromKey == null || !Number.isFinite(fromKey)) return null;
  return fromKey;
}

function emptyChannelStats(
  connected: boolean,
  overrides?: Partial<ReportChannelCost>,
): ReportChannelCost {
  return {
    amount: 0,
    impressions: 0,
    clicks: 0,
    currency: normalizeReportDisplayCurrency(),
    connected,
    loading: false,
    error: null,
    accountLabel: null,
    ...overrides,
  };
}

export function useDmReportSummaryPeriodCompare() {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const {
    dateSelection,
    googleCustomerId,
    metaAdAccountId,
    tiktokAdvertiserId,
    filtersHydrated,
    reportChartYear,
    reportServiceFilter,
  } = useDigitalMarketingPaidAdsFilters();

  const { data: googleReportingEnabled = false } = useGoogleAdsReportingEnabled(organizationId);
  const { data: metaReportingEnabled = false } = useMetaAdsReportingEnabled(organizationId);
  const { data: tiktokReportingEnabled = false } = useTikTokAdsReportingEnabled(organizationId);

  const { data: googleAccountsRaw = [] } = useQuery({
    queryKey: googleAdsAccountsReportQueryKey(organizationId),
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
    enabled: Boolean(organizationId) && googleReportingEnabled,
    staleTime: 60_000,
  });

  const googleAccounts = useMemo(
    () => (googleReportingEnabled ? googleAccountsRaw : []),
    [googleReportingEnabled, googleAccountsRaw],
  );

  const effectiveGoogleCustomerId = useMemo(() => {
    if (googleCustomerId) return googleCustomerId;
    const def = googleAccounts.find((a) => a.is_default);
    return def?.customer_id ?? googleAccounts[0]?.customer_id ?? "";
  }, [googleCustomerId, googleAccounts]);

  const { data: accountDateBounds } = useGoogleAdsAccountDateBounds(
    organizationId,
    effectiveGoogleCustomerId,
    Boolean(organizationId && effectiveGoogleCustomerId),
  );
  const googleAccountEarliestYmd = accountDateBounds?.earliest_date ?? null;

  const googleDateRangePayload = useMemo(
    () =>
      resolveReportGoogleDateRangePayload(
        dateSelection,
        reportChartYear,
        googleAccountEarliestYmd,
      ),
    [dateSelection, reportChartYear, googleAccountEarliestYmd],
  );

  const previousRange = useMemo(
    () =>
      resolvePreviousPaidAdsDateRange(
        dateSelection,
        googleDateRangePayload.start ?? null,
        googleDateRangePayload.end ?? null,
      ),
    [dateSelection, googleDateRangePayload.start, googleDateRangePayload.end],
  );

  const { data: metaSettings } = useMetaAdsSettings(organizationId, {
    enabled: Boolean(organizationId),
  });
  const metricsReadyMetaAccounts = useMemo(
    () =>
      metaSettings?.oauthConnected
        ? (metaSettings?.accounts ?? []).filter((a) => a.is_active && a.pixel_id !== "0")
        : [],
    [metaSettings?.accounts, metaSettings?.oauthConnected],
  );
  const effectiveMetaAdAccountId = useMemo(() => {
    if (metaAdAccountId) return metaAdAccountId;
    const def =
      metricsReadyMetaAccounts.find((a) => a.is_default) ?? metricsReadyMetaAccounts[0];
    return def?.ad_account_id ?? "";
  }, [metaAdAccountId, metricsReadyMetaAccounts]);

  const { data: tiktokSettings } = useTikTokAdsSettings(organizationId, {
    enabled: Boolean(organizationId),
  });
  const metricsReadyTikTokAccounts = useMemo(
    () =>
      tiktokSettings?.oauthConnected
        ? (tiktokSettings?.accounts ?? []).filter((a) => a.is_active)
        : [],
    [tiktokSettings?.accounts, tiktokSettings?.oauthConnected],
  );
  const effectiveTikTokAdvertiserId = useMemo(() => {
    if (tiktokAdvertiserId) return tiktokAdvertiserId;
    const def =
      metricsReadyTikTokAccounts.find((a) => a.is_default) ?? metricsReadyTikTokAccounts[0];
    return def?.advertiser_id ?? "";
  }, [tiktokAdvertiserId, metricsReadyTikTokAccounts]);

  const metaLookbackSkip = Boolean(
    previousRange && previousRange.toDate < metaAdsAllTimeDateRange().start,
  );
  const tiktokLookbackSkip = Boolean(
    previousRange && previousRange.toDate < tiktokAdsAllTimeDateRange().start,
  );

  const baseEnabled = Boolean(filtersHydrated && organizationId && previousRange);

  const googleEnabled = Boolean(
    baseEnabled && googleReportingEnabled && effectiveGoogleCustomerId,
  );
  const metaEnabled = Boolean(
    baseEnabled && metaReportingEnabled && effectiveMetaAdAccountId && !metaLookbackSkip,
  );
  const tiktokEnabled = Boolean(
    baseEnabled &&
      tiktokReportingEnabled &&
      effectiveTikTokAdvertiserId &&
      !tiktokLookbackSkip,
  );

  const googleCompareFilters = useMemo((): GoogleAdsMetricsFilters | null => {
    if (!previousRange || !effectiveGoogleCustomerId) return null;
    return {
      customerId: effectiveGoogleCustomerId,
      entity: "campaign",
      metrics: [...GOOGLE_REPORT_SUMMARY_METRICS],
      dateRange: { start: previousRange.fromDate, end: previousRange.toDate },
      onlyRunning: false,
      statusFilter: "all",
      pageToken: "",
      pageSize: 1,
      sort: { field: "spent", direction: "desc" },
      summaryMetrics: [...GOOGLE_REPORT_SUMMARY_METRICS],
    };
  }, [previousRange, effectiveGoogleCustomerId]);

  const unmappedLabel = t("digitalMarketing.report.serviceUnmapped", "Belum di-map");

  const googleMetricsQuery = useQuery({
    queryKey: [
      "dm-report-google-metrics-compare",
      organizationId,
      effectiveGoogleCustomerId,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !googleCompareFilters) {
        throw new Error("Missing organization or Google compare filters");
      }
      return fetchGoogleAdsMetrics(organizationId, googleCompareFilters);
    },
    enabled: googleEnabled,
    staleTime: COMPARE_STALE_TIME,
    retry: false,
  });

  const googleByServiceQuery = useQuery({
    queryKey: [
      "dm-report-google-by-service-compare",
      organizationId,
      effectiveGoogleCustomerId,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !effectiveGoogleCustomerId || !previousRange) {
        throw new Error("Missing organization, customer, or previous range");
      }
      const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
        body: {
          action: "fetchReportByService",
          organization_id: organizationId,
          customer_id: effectiveGoogleCustomerId,
          date_range: { start: previousRange.fromDate, end: previousRange.toDate },
          unmapped_label: unmappedLabel,
        },
      });
      if (error) throw await parseGoogleEdgeError(error, data);
      const payload = data as {
        rows?: ReportByServiceApiRow[];
        currency_code?: string | null;
        error?: string;
      };
      if (payload?.error) throw await parseGoogleEdgeError(null, payload);
      return {
        aggregates: mapReportByServiceApiRows(payload.rows),
        currencyCode: payload.currency_code ?? null,
      };
    },
    enabled: googleEnabled,
    staleTime: COMPARE_STALE_TIME,
    retry: false,
  });

  const metaMetricsQuery = useQuery({
    queryKey: [
      "dm-report-meta-metrics-compare",
      organizationId,
      effectiveMetaAdAccountId,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !effectiveMetaAdAccountId || !previousRange) {
        throw new Error("Missing organization, ad account, or previous range");
      }
      return fetchMetaAdsMetrics({
        organizationId,
        adAccountId: effectiveMetaAdAccountId,
        entity: "campaign",
        dateStart: previousRange.fromDate,
        dateEnd: previousRange.toDate,
        pageToken: "",
      });
    },
    enabled: metaEnabled,
    staleTime: COMPARE_STALE_TIME,
    retry: false,
  });

  const metaByServiceQuery = useQuery({
    queryKey: [
      "dm-report-meta-by-service-compare",
      organizationId,
      effectiveMetaAdAccountId,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !effectiveMetaAdAccountId || !previousRange) {
        throw new Error("Missing organization, ad account, or previous range");
      }
      const { data, error } = await supabase.functions.invoke("meta-ads-metrics", {
        body: {
          action: "fetchReportByService",
          organization_id: organizationId,
          ad_account_id: effectiveMetaAdAccountId,
          date_start: previousRange.fromDate,
          date_end: previousRange.toDate,
          unmapped_label: unmappedLabel,
        },
      });
      if (error) throw await parseMetaEdgeError(error, data);
      const payload = data as {
        rows?: MetaReportByServiceApiRow[];
        currency_code?: string | null;
        error?: string;
      };
      if (payload?.error) throw await parseMetaEdgeError(null, payload);
      return {
        aggregates: mapMetaReportByServiceApiRows(payload.rows),
        currencyCode: payload.currency_code ?? null,
      };
    },
    enabled: metaEnabled,
    staleTime: COMPARE_STALE_TIME,
    retry: false,
  });

  const tiktokMetricsQuery = useQuery({
    queryKey: [
      "dm-report-tiktok-metrics-compare",
      organizationId,
      effectiveTikTokAdvertiserId,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !effectiveTikTokAdvertiserId || !previousRange) {
        throw new Error("Missing organization, advertiser, or previous range");
      }
      return fetchTikTokAdsMetrics({
        organizationId,
        advertiserId: effectiveTikTokAdvertiserId,
        entity: "campaign",
        dateStart: previousRange.fromDate,
        dateEnd: previousRange.toDate,
        pageToken: "",
      });
    },
    enabled: tiktokEnabled,
    staleTime: COMPARE_STALE_TIME,
    retry: false,
  });

  const tiktokByServiceQuery = useQuery({
    queryKey: [
      "dm-report-tiktok-by-service-compare",
      organizationId,
      effectiveTikTokAdvertiserId,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !effectiveTikTokAdvertiserId || !previousRange) {
        throw new Error("Missing organization, advertiser, or previous range");
      }
      const { data, error } = await supabase.functions.invoke("tiktok-ads-metrics", {
        body: {
          action: "fetchReportByService",
          organization_id: organizationId,
          advertiser_id: effectiveTikTokAdvertiserId,
          date_start: previousRange.fromDate,
          date_end: previousRange.toDate,
          unmapped_label: unmappedLabel,
        },
      });
      if (error) throw await parseTikTokEdgeError(error, data);
      const payload = data as {
        rows?: TikTokReportByServiceApiRow[];
        currency_code?: string | null;
        error?: string;
      };
      if (payload?.error) throw await parseTikTokEdgeError(null, payload);
      return {
        aggregates: mapTikTokReportByServiceApiRows(payload.rows),
        currencyCode: payload.currency_code ?? null,
      };
    },
    enabled: tiktokEnabled,
    staleTime: COMPARE_STALE_TIME,
    retry: false,
  });

  const googleChannelFailed =
    googleEnabled && googleMetricsQuery.isError && googleByServiceQuery.isError;
  const metaChannelFailed =
    metaEnabled && metaMetricsQuery.isError && metaByServiceQuery.isError;
  const tiktokChannelFailed =
    tiktokEnabled && tiktokMetricsQuery.isError && tiktokByServiceQuery.isError;

  const enabledChannelCount =
    Number(googleEnabled) + Number(metaEnabled) + Number(tiktokEnabled);
  const failedChannelCount =
    Number(googleChannelFailed) + Number(metaChannelFailed) + Number(tiktokChannelFailed);
  const compareError = enabledChannelCount > 0 && failedChannelCount === enabledChannelCount;

  const compareLoading =
    Boolean(previousRange) &&
    ((googleEnabled && (googleMetricsQuery.isPending || googleByServiceQuery.isPending)) ||
      (metaEnabled && (metaMetricsQuery.isPending || metaByServiceQuery.isPending)) ||
      (tiktokEnabled && (tiktokMetricsQuery.isPending || tiktokByServiceQuery.isPending)));

  const previousTotals = useMemo((): ReportSummaryTotals | null => {
    if (!previousRange || compareLoading || compareError) return null;

    const serviceFilter = reportServiceFilter as ReportServiceFilterValue;

    const googleCost: ReportChannelCost = !googleEnabled
      ? emptyChannelStats(false)
      : googleMetricsQuery.isError
        ? emptyChannelStats(true, {
            amount: null,
            impressions: null,
            clicks: null,
            error: (googleMetricsQuery.error as Error).message,
          })
        : {
            amount: readGoogleSummaryMetric(googleMetricsQuery.data?.summary_totals, "spent") ?? 0,
            impressions:
              readGoogleSummaryMetric(googleMetricsQuery.data?.summary_totals, "impressions") ?? 0,
            clicks: readGoogleSummaryMetric(googleMetricsQuery.data?.summary_totals, "clicks") ?? 0,
            currency: googleMetricsQuery.data?.currency_code ?? "IDR",
            connected: true,
            loading: false,
            error: null,
            accountLabel: null,
          };

    const metaSummary = metaMetricsQuery.data?.summary;
    const metaCost: ReportChannelCost = !metaEnabled
      ? emptyChannelStats(false)
      : metaMetricsQuery.isError
        ? emptyChannelStats(true, {
            amount: null,
            impressions: null,
            clicks: null,
            error: (metaMetricsQuery.error as Error).message,
          })
        : {
            amount:
              metaSummary?.spend != null && Number.isFinite(metaSummary.spend)
                ? metaSummary.spend
                : 0,
            impressions:
              metaSummary?.impressions != null && Number.isFinite(metaSummary.impressions)
                ? metaSummary.impressions
                : 0,
            clicks:
              metaSummary?.clicks != null && Number.isFinite(metaSummary.clicks)
                ? metaSummary.clicks
                : 0,
            currency: normalizeMetaAdsReportCurrency(metaSummary?.currency),
            connected: true,
            loading: false,
            error: null,
            accountLabel: null,
          };

    const tiktokSummary = tiktokMetricsQuery.data?.summary;
    const tiktokCost: ReportChannelCost = !tiktokEnabled
      ? emptyChannelStats(false)
      : tiktokMetricsQuery.isError
        ? emptyChannelStats(true, {
            amount: null,
            impressions: null,
            clicks: null,
            error: (tiktokMetricsQuery.error as Error).message,
          })
        : {
            amount:
              tiktokSummary?.spend != null && Number.isFinite(tiktokSummary.spend)
                ? tiktokSummary.spend
                : 0,
            impressions:
              tiktokSummary?.impressions != null && Number.isFinite(tiktokSummary.impressions)
                ? tiktokSummary.impressions
                : 0,
            clicks:
              tiktokSummary?.clicks != null && Number.isFinite(tiktokSummary.clicks)
                ? tiktokSummary.clicks
                : 0,
            currency: normalizeReportDisplayCurrency(tiktokSummary?.currency),
            connected: true,
            loading: false,
            error: null,
            accountLabel: null,
          };

    const googleServiceRows: ReportGoogleServiceRow[] =
      googleEnabled && !googleByServiceQuery.isError
        ? (googleByServiceQuery.data?.aggregates ?? []).map((row) => ({
            ...row,
            currency: googleByServiceQuery.data?.currencyCode ?? googleCost.currency ?? "IDR",
          }))
        : [];
    const metaServiceRows: ReportMetaServiceRow[] =
      metaEnabled && !metaByServiceQuery.isError
        ? (metaByServiceQuery.data?.aggregates ?? []).map((row) => ({
            ...row,
            currency: normalizeMetaAdsReportCurrency(
              metaByServiceQuery.data?.currencyCode ?? metaCost.currency,
            ),
          }))
        : [];
    const tiktokServiceRows: ReportTikTokServiceRow[] =
      tiktokEnabled && !tiktokByServiceQuery.isError
        ? (tiktokByServiceQuery.data?.aggregates ?? []).map((row) => ({
            ...row,
            currency: normalizeReportDisplayCurrency(
              tiktokByServiceQuery.data?.currencyCode ?? tiktokCost.currency,
            ),
          }))
        : [];

    const filteredGoogleRows = googleServiceRows.filter((row) =>
      reportRowMatchesServiceFilter(row, serviceFilter),
    );
    const filteredMetaRows = metaServiceRows.filter((row) =>
      reportRowMatchesServiceFilter(row, serviceFilter),
    );
    const filteredTikTokRows = tiktokServiceRows.filter((row) =>
      reportRowMatchesServiceFilter(row, serviceFilter),
    );

    const hasServiceRows =
      filteredGoogleRows.length > 0 ||
      filteredMetaRows.length > 0 ||
      filteredTikTokRows.length > 0;

    if (hasServiceRows) {
      return aggregateReportTableMetrics(filteredGoogleRows, filteredMetaRows, filteredTikTokRows);
    }
    return aggregateReportChannelCosts(googleCost, metaCost, tiktokCost);
  }, [
    previousRange,
    compareLoading,
    compareError,
    reportServiceFilter,
    googleEnabled,
    metaEnabled,
    tiktokEnabled,
    googleMetricsQuery.data,
    googleMetricsQuery.isError,
    googleMetricsQuery.error,
    googleByServiceQuery.data,
    googleByServiceQuery.isError,
    metaMetricsQuery.data,
    metaMetricsQuery.isError,
    metaMetricsQuery.error,
    metaByServiceQuery.data,
    metaByServiceQuery.isError,
    tiktokMetricsQuery.data,
    tiktokMetricsQuery.isError,
    tiktokMetricsQuery.error,
    tiktokByServiceQuery.data,
    tiktokByServiceQuery.isError,
  ]);

  return {
    previousRange,
    previousTotals,
    compareLoading,
    compareError,
  };
}

export function reportPeriodCompareBits(args: {
  metricKey: ReportTableMetricKey;
  currentTotals: ReportSummaryTotals | null | undefined;
  previousTotals: ReportSummaryTotals | null | undefined;
  previousRange: PreviousPaidAdsDateRange | null;
  compareLoading: boolean;
  compareError?: boolean;
  mixedCurrencyLabel?: string;
}) {
  const visible = Boolean(args.previousRange) && !args.compareError;
  const current = reportSummaryNumericValue(args.metricKey, args.currentTotals ?? null);
  const previous = reportSummaryNumericValue(args.metricKey, args.previousTotals ?? null);
  const compareDelta =
    visible && !args.compareLoading ? computeKpiCompareDelta(current, previous) : null;
  const compareRangeLabel = args.previousRange
    ? formatCompareDateRange(args.previousRange.fromDate, args.previousRange.toDate, new Date(), {
        compact: true,
      })
    : "";
  const comparePreviousText = formatReportSummaryMetricValue(
    args.metricKey,
    args.previousTotals ?? null,
    { mixedCurrencyLabel: args.mixedCurrencyLabel },
  );
  return {
    compareDelta,
    compareRangeLabel,
    comparePreviousText,
    compareLoading: visible && args.compareLoading,
    compareVisible: visible,
    compareMetricKey: reportCompareToneKey(args.metricKey),
  };
}
