import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  buildReportCombinedChannelScope,
  combineMonthlyGoogleMeta,
  serviceFilterForApi,
  type ReportCombinedChannelScope,
} from "@/6-0-digital-marketing-shared/reportServiceFilter";
import { useGoogleAdsReportingEnabled } from "@/google-ads/hooks/useGoogleAdsReportingEnabled";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
import { useMetaAdsReportingEnabled } from "@/meta-ads/hooks/useMetaAdsReportingEnabled";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import {
  isReportMetaRangeUnavailableForCharts,
  resolveReportChartMonthlyDateSelection,
  resolveReportGoogleDateRangePayloadForCharts,
  resolveReportMetaDateRangePayloadForCharts,
} from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";
import { parseEdgeFunctionError as parseGoogleEdgeError } from "@/google-ads/lib/parseEdgeFunctionError";
import { parseEdgeFunctionError as parseMetaEdgeError } from "@/meta-ads/lib/parseEdgeFunctionError";
import { normalizeMetaAdsReportCurrency } from "@/meta-ads/lib/metaAdsReportCurrency";
import { googleAdsAccountsReportQueryKey } from "@/6-0-digital-marketing-shared/reportQueryKeys";
import { supabase } from "@/shared/lib/supabaseClient";

export type MonthlySpendBucket = {
  year?: number;
  month: number;
  spend: number;
  converted_leads?: number;
  cpa?: number | null;
};

export type ReportChartSpanMode = "calendar_year" | "all_time";

export type ChannelPeriodSummary = {
  spend: number;
  converted_leads: number;
  cpa: number | null;
};

export type MonthlySpendChannelSeries = {
  connected: boolean;
  loading: boolean;
  error: string | null;
  /** Soft skip (e.g. Meta beyond 37-month lookback) — chart still shows other channels. */
  unavailableReason?: string | null;
  currency: string | null;
  months: MonthlySpendBucket[];
  /** Totals for chart date range — aligns table Cost / Conv. leads / CPA with chart data. */
  periodSummary: ChannelPeriodSummary | null;
};

export type ReportMonthlySpendChartPoint = {
  year: number;
  month: number;
  periodKey: string;
  shortMonth: string;
  googleSpend: number;
  metaSpend: number;
  totalSpend: number;
};

export type ReportMonthlyLeadsChartPoint = {
  year: number;
  month: number;
  periodKey: string;
  shortMonth: string;
  googleLeads: number;
  metaLeads: number;
  totalLeads: number;
};

export type MonthlySpendChannelFilter = "all" | "by_channel" | "google" | "meta";

export type ReportMonthlyCpaChartPoint = {
  year: number;
  month: number;
  periodKey: string;
  shortMonth: string;
  googleCpa: number | null;
  metaCpa: number | null;
  totalCpa: number | null;
  googleSpend: number;
  metaSpend: number;
  /** Scoped totals for "All channels" (matches table when a service filter is active). */
  totalSpend: number;
  totalLeads: number;
  googleLeads: number;
  metaLeads: number;
};

type MonthlySpendApiResponse = {
  year: number;
  currency?: string | null;
  currency_code?: string | null;
  months: MonthlySpendBucket[];
  period_summary?: ChannelPeriodSummary | null;
  error?: string;
};

function parsePeriodSummary(raw: unknown): ChannelPeriodSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as ChannelPeriodSummary;
  const spend = Number(row.spend);
  const converted_leads = Number(row.converted_leads);
  const cpa =
    row.cpa !== undefined && row.cpa !== null
      ? Number(row.cpa)
      : spend > 0 && converted_leads > 0
        ? spend / converted_leads
        : null;
  return {
    spend: Number.isFinite(spend) ? spend : 0,
    converted_leads: Number.isFinite(converted_leads) ? converted_leads : 0,
    cpa: cpa != null && Number.isFinite(cpa) ? cpa : null,
  };
}

function normalizeYear(year: number | string): number {
  const n = typeof year === "string" ? Number(year) : year;
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return new Date().getFullYear();
  return Math.floor(n);
}

function emptyMonths(fallbackYear = new Date().getFullYear()): MonthlySpendBucket[] {
  return Array.from({ length: 12 }, (_, i) => ({
    year: fallbackYear,
    month: i + 1,
    spend: 0,
    converted_leads: 0,
    cpa: null,
  }));
}

function monthPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function normalizeMonthlyBuckets(
  raw: MonthlySpendBucket[] | undefined,
  fallbackYear: number,
): MonthlySpendBucket[] {
  if (!raw?.length) return emptyMonths(fallbackYear);
  const hasYear = raw.some((r) => r.year != null && Number.isFinite(Number(r.year)));
  if (hasYear) {
    return [...raw]
      .map((r) => ({
        year: Number(r.year),
        month: r.month,
        spend: r.spend ?? 0,
        converted_leads: r.converted_leads ?? 0,
        cpa:
          r.cpa !== undefined
            ? r.cpa
            : (r.spend ?? 0) > 0 && (r.converted_leads ?? 0) > 0
              ? (r.spend ?? 0) / (r.converted_leads ?? 0)
              : null,
      }))
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  }
  const byMonth = new Map(raw.map((r) => [r.month, r]));
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const row = byMonth.get(month);
    const spend = row?.spend ?? 0;
    const converted_leads = row?.converted_leads ?? 0;
    const cpa =
      row?.cpa !== undefined
        ? row.cpa
        : spend > 0 && converted_leads > 0
          ? spend / converted_leads
          : null;
    return { year: fallbackYear, month, spend, converted_leads, cpa };
  });
}

function collectChartPeriods(
  google: MonthlySpendChannelSeries,
  meta: MonthlySpendChannelSeries,
  fallbackYear: number,
): Array<{ year: number; month: number; periodKey: string }> {
  const keys = new Map<string, { year: number; month: number }>();
  const add = (rows: MonthlySpendBucket[]) => {
    for (const r of rows) {
      const year = r.year ?? fallbackYear;
      const key = monthPeriodKey(year, r.month);
      if (!keys.has(key)) keys.set(key, { year, month: r.month });
    }
  };
  add(google.months);
  add(meta.months);
  if (keys.size === 0) {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return { year: fallbackYear, month, periodKey: monthPeriodKey(fallbackYear, month) };
    });
  }
  return [...keys.values()].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  ).map((p) => ({ ...p, periodKey: monthPeriodKey(p.year, p.month) }));
}

function formatChartMonthLabel(year: number, month: number, locale: string): string {
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(d);
}

/** All time: sum spend/leads per calendar month (Jan–Dec) across every year in range. */
function aggregateBucketsByCalendarMonth(
  rows: MonthlySpendBucket[],
): MonthlySpendBucket[] {
  const sums = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    spend: 0,
    converted_leads: 0,
  }));
  for (const r of rows) {
    if (r.month < 1 || r.month > 12) continue;
    const slot = sums[r.month - 1]!;
    slot.spend += Number.isFinite(r.spend) ? r.spend : 0;
    slot.converted_leads += Number.isFinite(r.converted_leads) ? r.converted_leads! : 0;
  }
  return sums.map((b) => ({
    month: b.month,
    spend: b.spend,
    converted_leads: b.converted_leads,
    cpa:
      b.spend > 0 && b.converted_leads > 0 ? b.spend / b.converted_leads : null,
  }));
}

function findBucketForChart(
  rows: MonthlySpendBucket[],
  month: number,
  year: number,
  spanMode: ReportChartSpanMode,
): MonthlySpendBucket | undefined {
  if (spanMode === "all_time") {
    return rows.find((m) => m.month === month);
  }
  return rows.find((m) => (m.year ?? year) === year && m.month === month);
}

export function sumMonthlySpendBuckets(months: MonthlySpendBucket[]): number {
  return months.reduce((total, row) => total + (Number.isFinite(row.spend) ? row.spend : 0), 0);
}

export function sumMonthlyConvertedLeads(months: MonthlySpendBucket[]): number {
  return months.reduce(
    (total, row) => total + (Number.isFinite(row.converted_leads) ? row.converted_leads! : 0),
    0,
  );
}

/** Table totals derived from the same monthly buckets as the CPA chart (guaranteed sync). */
export function buildPeriodSummaryFromMonths(
  months: MonthlySpendBucket[],
): ChannelPeriodSummary {
  const spend = sumMonthlySpendBuckets(months);
  const converted_leads = sumMonthlyConvertedLeads(months);
  const cpa =
    spend > 0 && converted_leads > 0 ? spend / converted_leads : null;
  return { spend, converted_leads, cpa };
}

function effectivePeriodSummary(
  months: MonthlySpendBucket[],
  fromApi: ChannelPeriodSummary | null,
): ChannelPeriodSummary | null {
  const fromMonths = buildPeriodSummaryFromMonths(months);
  if (!fromApi) return fromMonths;
  if (
    fromApi.converted_leads === fromMonths.converted_leads &&
    Math.abs(fromApi.spend - fromMonths.spend) < 0.01
  ) {
    return fromApi;
  }
  return fromMonths;
}

export function buildReportYearOptions(maxYears = 6): string[] {
  const current = new Date().getFullYear();
  return Array.from({ length: maxYears }, (_, i) => String(current - i));
}

export function buildMonthlyLeadsChartPoints(args: {
  year: number;
  locale: string;
  spanMode?: ReportChartSpanMode;
  google: MonthlySpendChannelSeries;
  meta: MonthlySpendChannelSeries;
  combinedScope?: ReportCombinedChannelScope;
}): ReportMonthlyLeadsChartPoint[] {
  const { year, locale, google, meta, combinedScope, spanMode = "calendar_year" } = args;
  const scope =
    combinedScope ??
    buildReportCombinedChannelScope({
      serviceFilterActive: false,
      hasGoogleServiceRow: true,
      hasMetaServiceRow: true,
      googleConnected: google.connected,
      metaConnected: meta.connected,
    });

  const googleMonths =
    spanMode === "all_time"
      ? aggregateBucketsByCalendarMonth(google.months)
      : google.months;
  const metaMonths =
    spanMode === "all_time" ? aggregateBucketsByCalendarMonth(meta.months) : meta.months;
  const periods =
    spanMode === "all_time"
      ? Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          return { year, month, periodKey: `cal-${month}` };
        })
      : collectChartPeriods(google, meta, year);

  return periods.map(({ year: y, month, periodKey }) => {
    const googleRow = findBucketForChart(googleMonths, month, y, spanMode);
    const metaRow = findBucketForChart(metaMonths, month, y, spanMode);
    const googleLeads = google.connected ? (googleRow?.converted_leads ?? 0) : 0;
    const metaLeads = meta.connected ? (metaRow?.converted_leads ?? 0) : 0;
    return {
      year: y,
      month,
      periodKey,
      shortMonth: formatChartMonthLabel(y, month, locale),
      googleLeads,
      metaLeads,
      totalLeads: combineMonthlyGoogleMeta(googleLeads, metaLeads, scope),
    };
  });
}

export function buildMonthlySpendChartPoints(args: {
  year: number;
  locale: string;
  spanMode?: ReportChartSpanMode;
  google: MonthlySpendChannelSeries;
  meta: MonthlySpendChannelSeries;
  combinedScope?: ReportCombinedChannelScope;
}): ReportMonthlySpendChartPoint[] {
  const { year, locale, google, meta, combinedScope, spanMode = "calendar_year" } = args;
  const scope =
    combinedScope ??
    buildReportCombinedChannelScope({
      serviceFilterActive: false,
      hasGoogleServiceRow: true,
      hasMetaServiceRow: true,
      googleConnected: google.connected,
      metaConnected: meta.connected,
    });

  const googleMonths =
    spanMode === "all_time"
      ? aggregateBucketsByCalendarMonth(google.months)
      : google.months;
  const metaMonths =
    spanMode === "all_time" ? aggregateBucketsByCalendarMonth(meta.months) : meta.months;
  const periods =
    spanMode === "all_time"
      ? Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          return { year, month, periodKey: `cal-${month}` };
        })
      : collectChartPeriods(google, meta, year);

  return periods.map(({ year: y, month, periodKey }) => {
    const googleRow = findBucketForChart(googleMonths, month, y, spanMode);
    const metaRow = findBucketForChart(metaMonths, month, y, spanMode);
    const googleSpend = google.connected ? (googleRow?.spend ?? 0) : 0;
    const metaSpend = meta.connected ? (metaRow?.spend ?? 0) : 0;
    return {
      year: y,
      month,
      periodKey,
      shortMonth: formatChartMonthLabel(y, month, locale),
      googleSpend,
      metaSpend,
      totalSpend: combineMonthlyGoogleMeta(googleSpend, metaSpend, scope),
    };
  });
}

export function buildMonthlyCpaChartPoints(args: {
  year: number;
  locale: string;
  spanMode?: ReportChartSpanMode;
  google: MonthlySpendChannelSeries;
  meta: MonthlySpendChannelSeries;
  combinedScope?: ReportCombinedChannelScope;
}): ReportMonthlyCpaChartPoint[] {
  const { year, locale, google, meta, combinedScope, spanMode = "calendar_year" } = args;
  const scope =
    combinedScope ??
    buildReportCombinedChannelScope({
      serviceFilterActive: false,
      hasGoogleServiceRow: true,
      hasMetaServiceRow: true,
      googleConnected: google.connected,
      metaConnected: meta.connected,
    });
  const mixedCurrency =
    scope.includeGoogle &&
    scope.includeMeta &&
    google.connected &&
    meta.connected &&
    google.currency != null &&
    meta.currency != null &&
    google.currency !== meta.currency;
  const canCombineCpa = !mixedCurrency;

  const googleMonths =
    spanMode === "all_time"
      ? aggregateBucketsByCalendarMonth(google.months)
      : google.months;
  const metaMonths =
    spanMode === "all_time" ? aggregateBucketsByCalendarMonth(meta.months) : meta.months;
  const periods =
    spanMode === "all_time"
      ? Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          return { year, month, periodKey: `cal-${month}` };
        })
      : collectChartPeriods(google, meta, year);

  return periods.map(({ year: y, month, periodKey }) => {
    const googleRow = findBucketForChart(googleMonths, month, y, spanMode);
    const metaRow = findBucketForChart(metaMonths, month, y, spanMode);
    const googleSpend = google.connected ? (googleRow?.spend ?? 0) : 0;
    const metaSpend = meta.connected ? (metaRow?.spend ?? 0) : 0;
    const googleLeads = google.connected ? (googleRow?.converted_leads ?? 0) : 0;
    const metaLeads = meta.connected ? (metaRow?.converted_leads ?? 0) : 0;
    const googleCpa =
      google.connected && googleSpend > 0 && googleLeads > 0
        ? googleSpend / googleLeads
        : google.connected
          ? (googleRow?.cpa ?? null)
          : null;
    const metaCpa =
      meta.connected && metaSpend > 0 && metaLeads > 0
        ? metaSpend / metaLeads
        : meta.connected
          ? (metaRow?.cpa ?? null)
          : null;
    const totalLeads = combineMonthlyGoogleMeta(googleLeads, metaLeads, scope);
    const totalSpend = combineMonthlyGoogleMeta(googleSpend, metaSpend, scope);
    const totalCpa =
      canCombineCpa && totalLeads > 0 && totalSpend > 0 ? totalSpend / totalLeads : null;

    return {
      year: y,
      month,
      periodKey,
      shortMonth: formatChartMonthLabel(y, month, locale),
      googleCpa,
      metaCpa,
      totalCpa,
      googleSpend,
      metaSpend,
      totalSpend,
      totalLeads,
      googleLeads,
      metaLeads,
    };
  });
}

export type UseDigitalMarketingReportMonthlySpendOptions = {
  /** When true, applies reportChartCompareEnabled for chart API range and span mode. */
  forChartsCompare?: boolean;
  /** When false, monthly chart queries are not fetched (lazy / deferred load). */
  enabled?: boolean;
};

export function useDigitalMarketingReportMonthlySpend(
  year: number | string,
  options?: UseDigitalMarketingReportMonthlySpendOptions,
) {
  const selectedYear = normalizeYear(year);
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const {
    dateSelection,
    googleCustomerId,
    metaAdAccountId,
    filtersHydrated,
    reportServiceFilter,
    reportChartCompareEnabled,
  } = useDigitalMarketingPaidAdsFilters();

  const chartsQueryEnabled = options?.enabled ?? true;

  const compareActive = Boolean(
    options?.forChartsCompare && reportChartCompareEnabled,
  );

  const chartSpanMode: ReportChartSpanMode =
    compareActive || dateSelection.preset !== "all_time"
      ? "calendar_year"
      : "all_time";

  const apiServiceId = serviceFilterForApi(reportServiceFilter);

  const { data: googleReportingEnabled = false, isPending: googleReportingPending } =
    useGoogleAdsReportingEnabled(organizationId);
  const { data: metaReportingEnabled = false, isPending: metaReportingPending } =
    useMetaAdsReportingEnabled(organizationId);

  const { data: googleAccounts = [], isPending: googleAccountsPending } = useQuery({
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
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });

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

  const chartDateSelection = useMemo(
    () =>
      resolveReportChartMonthlyDateSelection(
        dateSelection,
        selectedYear,
        compareActive,
        googleAccountEarliestYmd,
      ),
    [dateSelection, selectedYear, compareActive, googleAccountEarliestYmd],
  );

  const chartDateOverlap = chartDateSelection != null;

  const googleReportRange = useMemo(
    () =>
      resolveReportGoogleDateRangePayloadForCharts(
        dateSelection,
        selectedYear,
        compareActive,
        googleAccountEarliestYmd,
      ),
    [dateSelection, selectedYear, compareActive, googleAccountEarliestYmd],
  );

  const metaReportRange = useMemo(
    () =>
      resolveReportMetaDateRangePayloadForCharts(
        dateSelection,
        selectedYear,
        compareActive,
      ),
    [dateSelection, selectedYear, compareActive],
  );

  const metaRangeWithinLookback = useMemo(
    () =>
      !isReportMetaRangeUnavailableForCharts(
        dateSelection,
        selectedYear,
        compareActive,
        googleAccountEarliestYmd,
      ),
    [dateSelection, selectedYear, compareActive, googleAccountEarliestYmd],
  );

  const { data: metaSettings, isPending: metaSettingsPending } = useMetaAdsSettings(
    organizationId,
    { enabled: Boolean(organizationId) },
  );

  const metricsReadyMetaAccounts = useMemo(
    () =>
      (metaSettings?.accounts ?? []).filter((a) => a.is_active && a.pixel_id !== "0"),
    [metaSettings?.accounts],
  );

  const effectiveMetaAdAccountId = useMemo(() => {
    if (metaAdAccountId) return metaAdAccountId;
    const def =
      metricsReadyMetaAccounts.find((a) => a.is_default) ?? metricsReadyMetaAccounts[0];
    return def?.ad_account_id ?? "";
  }, [metaAdAccountId, metricsReadyMetaAccounts]);

  const googleMonthlyQuery = useQuery({
    queryKey: [
      "dm-report-google-monthly-spend-v11",
      organizationId,
      effectiveGoogleCustomerId,
      selectedYear,
      googleReportRange?.start,
      googleReportRange?.end,
      apiServiceId ?? "",
      compareActive,
    ],
    queryFn: async (): Promise<MonthlySpendApiResponse> => {
      if (!organizationId || !effectiveGoogleCustomerId || !googleReportRange) {
        throw new Error("Missing organization or Google customer");
      }
      const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
        body: {
          action: "fetchMonthlySpend",
          organization_id: organizationId,
          customer_id: effectiveGoogleCustomerId,
          year: selectedYear,
          date_start: googleReportRange.start,
          date_end: googleReportRange.end,
          ...(apiServiceId ? { service_id: apiServiceId } : {}),
        },
      });
      if (error) throw await parseGoogleEdgeError(error, data);
      const payload = data as MonthlySpendApiResponse;
      if (payload?.error) throw await parseGoogleEdgeError(null, payload);
      return payload;
    },
    enabled: Boolean(
      chartsQueryEnabled &&
        filtersHydrated &&
        organizationId &&
        googleReportingEnabled &&
        effectiveGoogleCustomerId &&
        chartDateOverlap &&
        googleReportRange,
    ),
    staleTime: 10 * 60 * 1000,
  });

  const metaMonthlyQuery = useQuery({
    queryKey: [
      "dm-report-meta-monthly-spend-v10",
      organizationId,
      effectiveMetaAdAccountId,
      selectedYear,
      metaReportRange?.start,
      metaReportRange?.end,
      apiServiceId ?? "",
      compareActive,
    ],
    queryFn: async (): Promise<MonthlySpendApiResponse> => {
      if (!organizationId || !effectiveMetaAdAccountId || !metaReportRange) {
        throw new Error("Missing organization or Meta ad account");
      }
      const { data, error } = await supabase.functions.invoke("meta-ads-metrics", {
        body: {
          organization_id: organizationId,
          ad_account_id: effectiveMetaAdAccountId,
          monthly_breakdown: true,
          year: selectedYear,
          date_start: metaReportRange.start,
          date_end: metaReportRange.end,
          ...(apiServiceId ? { service_id: apiServiceId } : {}),
        },
      });
      if (error) throw await parseMetaEdgeError(error, data);
      const payload = data as MonthlySpendApiResponse;
      if (payload?.error) throw await parseMetaEdgeError(null, payload);
      return payload;
    },
    enabled: Boolean(
      chartsQueryEnabled &&
        filtersHydrated &&
        organizationId &&
        metaReportingEnabled &&
        effectiveMetaAdAccountId &&
        chartDateOverlap &&
        metaReportRange &&
        metaRangeWithinLookback,
    ),
    staleTime: 10 * 60 * 1000,
  });

  const googleSeries: MonthlySpendChannelSeries = useMemo(() => {
    const loading =
      chartsQueryEnabled &&
      (orgLoading ||
        !filtersHydrated ||
        googleReportingPending ||
        googleAccountsPending ||
        (googleReportingEnabled && googleMonthlyQuery.isLoading));
    if (!chartsQueryEnabled) {
      return {
        connected: Boolean(googleReportingEnabled),
        loading: false,
        error: null,
        currency: null,
        months: emptyMonths(selectedYear),
        periodSummary: null,
      };
    }
    if (!googleReportingEnabled) {
      return {
        connected: false,
        loading,
        error: null,
        currency: null,
        months: emptyMonths(selectedYear),
        periodSummary: null,
      };
    }
    if (!chartDateOverlap) {
      return {
        connected: true,
        loading: false,
        error: "Date range does not overlap the selected chart year.",
        currency: null,
        months: emptyMonths(selectedYear),
        periodSummary: null,
      };
    }
    if (googleMonthlyQuery.isError) {
      return {
        connected: true,
        loading: false,
        error: (googleMonthlyQuery.error as Error).message,
        currency: null,
        months: emptyMonths(selectedYear),
        periodSummary: null,
      };
    }
    const data = googleMonthlyQuery.data;
    const months = normalizeMonthlyBuckets(data?.months, selectedYear);
    return {
      connected: true,
      loading,
      error: null,
      currency: data?.currency_code ?? data?.currency ?? "IDR",
      months,
      periodSummary: effectivePeriodSummary(months, parsePeriodSummary(data?.period_summary)),
    };
  }, [
    chartsQueryEnabled,
    orgLoading,
    filtersHydrated,
    googleReportingPending,
    googleAccountsPending,
    googleReportingEnabled,
    googleMonthlyQuery,
    chartDateOverlap,
    selectedYear,
  ]);

  const metaSeries: MonthlySpendChannelSeries = useMemo(() => {
    const loading =
      chartsQueryEnabled &&
      (orgLoading ||
        !filtersHydrated ||
        metaReportingPending ||
        metaSettingsPending ||
        (metaReportingEnabled && metaMonthlyQuery.isLoading));
    if (!chartsQueryEnabled) {
      return {
        connected: Boolean(metaReportingEnabled),
        loading: false,
        error: null,
        currency: null,
        months: emptyMonths(selectedYear),
        periodSummary: null,
      };
    }
    if (!metaReportingEnabled) {
      return {
        connected: false,
        loading,
        error: null,
        currency: null,
        months: emptyMonths(selectedYear),
        periodSummary: null,
      };
    }
    if (!chartDateOverlap) {
      return {
        connected: true,
        loading: false,
        error: "Date range does not overlap the selected chart year.",
        currency: null,
        months: emptyMonths(selectedYear),
        periodSummary: null,
      };
    }
    if (!metaRangeWithinLookback) {
      return {
        connected: true,
        loading: false,
        error: null,
        unavailableReason:
          "Meta Ads data is unavailable beyond 37 months from today.",
        currency: null,
        months: emptyMonths(selectedYear),
        periodSummary: null,
      };
    }
    if (metaMonthlyQuery.isError) {
      return {
        connected: true,
        loading: false,
        error: (metaMonthlyQuery.error as Error).message,
        currency: null,
        months: emptyMonths(selectedYear),
        periodSummary: null,
      };
    }
    const data = metaMonthlyQuery.data;
    const months = normalizeMonthlyBuckets(data?.months, selectedYear);
    return {
      connected: true,
      loading,
      error: null,
      currency: normalizeMetaAdsReportCurrency(data?.currency ?? data?.currency_code),
      months,
      periodSummary: effectivePeriodSummary(months, parsePeriodSummary(data?.period_summary)),
    };
  }, [
    chartsQueryEnabled,
    orgLoading,
    filtersHydrated,
    metaReportingPending,
    metaSettingsPending,
    metaReportingEnabled,
    metaMonthlyQuery,
    chartDateOverlap,
    metaRangeWithinLookback,
    selectedYear,
  ]);

  const bootstrapLoading =
    orgLoading ||
    !filtersHydrated ||
    googleReportingPending ||
    metaReportingPending ||
    googleAccountsPending ||
    metaSettingsPending;

  return {
    selectedYear,
    chartSpanMode,
    compareActive,
    googleSeries,
    metaSeries,
    bootstrapLoading,
    chartLoading: chartsQueryEnabled
      ? googleSeries.loading ||
        (metaRangeWithinLookback ? metaSeries.loading : false)
      : false,
    chartDateOverlap,
    chartDateSelection,
  };
}
