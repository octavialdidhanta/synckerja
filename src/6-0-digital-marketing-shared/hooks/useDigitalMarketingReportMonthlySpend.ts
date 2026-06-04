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
import {
  intersectDateSelectionWithChartYear,
  toGoogleAdsMetricsDateRangePayload,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { useGoogleAdsReportingEnabled } from "@/google-ads/hooks/useGoogleAdsReportingEnabled";
import { useMetaAdsReportingEnabled } from "@/meta-ads/hooks/useMetaAdsReportingEnabled";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import { metaAdsEarliestAllowedStartYmd } from "@/meta-ads/lib/clampMetaAdsDateRange";
import { toMetaAdsMetricsDateRangePayload } from "@/meta-ads/lib/toMetaAdsMetricsDateRangePayload";
import { parseEdgeFunctionError as parseGoogleEdgeError } from "@/google-ads/lib/parseEdgeFunctionError";
import { parseEdgeFunctionError as parseMetaEdgeError } from "@/meta-ads/lib/parseEdgeFunctionError";
import { normalizeMetaAdsReportCurrency } from "@/meta-ads/lib/metaAdsReportCurrency";
import { supabase } from "@/shared/lib/supabaseClient";

export type MonthlySpendBucket = {
  month: number;
  spend: number;
  converted_leads?: number;
  cpa?: number | null;
};

export type ChannelPeriodSummary = {
  spend: number;
  converted_leads: number;
  cpa: number | null;
};

export type MonthlySpendChannelSeries = {
  connected: boolean;
  loading: boolean;
  error: string | null;
  currency: string | null;
  months: MonthlySpendBucket[];
  /** Totals for chart date range — aligns table Cost / Conv. leads / CPA with chart data. */
  periodSummary: ChannelPeriodSummary | null;
};

export type ReportMonthlySpendChartPoint = {
  month: number;
  shortMonth: string;
  googleSpend: number;
  metaSpend: number;
  totalSpend: number;
};

export type ReportMonthlyLeadsChartPoint = {
  month: number;
  shortMonth: string;
  googleLeads: number;
  metaLeads: number;
  totalLeads: number;
};

export type MonthlySpendChannelFilter = "all" | "by_channel" | "google" | "meta";

export type ReportMonthlyCpaChartPoint = {
  month: number;
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

function emptyMonths(): MonthlySpendBucket[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    spend: 0,
    converted_leads: 0,
    cpa: null,
  }));
}

function normalizeMonthlyBuckets(raw: MonthlySpendBucket[] | undefined): MonthlySpendBucket[] {
  if (!raw?.length) return emptyMonths();
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
    return { month, spend, converted_leads, cpa };
  });
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
  google: MonthlySpendChannelSeries;
  meta: MonthlySpendChannelSeries;
  combinedScope?: ReportCombinedChannelScope;
}): ReportMonthlyLeadsChartPoint[] {
  const { year, locale, google, meta, combinedScope } = args;
  const formatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const scope =
    combinedScope ??
    buildReportCombinedChannelScope({
      serviceFilterActive: false,
      hasGoogleServiceRow: true,
      hasMetaServiceRow: true,
      googleConnected: google.connected,
      metaConnected: meta.connected,
    });

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const googleRow = google.months.find((m) => m.month === month);
    const metaRow = meta.months.find((m) => m.month === month);
    const googleLeads = google.connected ? (googleRow?.converted_leads ?? 0) : 0;
    const metaLeads = meta.connected ? (metaRow?.converted_leads ?? 0) : 0;
    return {
      month,
      shortMonth: formatter.format(new Date(year, i, 1)),
      googleLeads,
      metaLeads,
      totalLeads: combineMonthlyGoogleMeta(googleLeads, metaLeads, scope),
    };
  });
}

export function buildMonthlySpendChartPoints(args: {
  year: number;
  locale: string;
  google: MonthlySpendChannelSeries;
  meta: MonthlySpendChannelSeries;
  combinedScope?: ReportCombinedChannelScope;
}): ReportMonthlySpendChartPoint[] {
  const { year, locale, google, meta, combinedScope } = args;
  const formatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const scope =
    combinedScope ??
    buildReportCombinedChannelScope({
      serviceFilterActive: false,
      hasGoogleServiceRow: true,
      hasMetaServiceRow: true,
      googleConnected: google.connected,
      metaConnected: meta.connected,
    });

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const googleRow = google.months.find((m) => m.month === month);
    const metaRow = meta.months.find((m) => m.month === month);
    const googleSpend = google.connected ? (googleRow?.spend ?? 0) : 0;
    const metaSpend = meta.connected ? (metaRow?.spend ?? 0) : 0;
    return {
      month,
      shortMonth: formatter.format(new Date(year, i, 1)),
      googleSpend,
      metaSpend,
      totalSpend: combineMonthlyGoogleMeta(googleSpend, metaSpend, scope),
    };
  });
}

export function buildMonthlyCpaChartPoints(args: {
  year: number;
  locale: string;
  google: MonthlySpendChannelSeries;
  meta: MonthlySpendChannelSeries;
  combinedScope?: ReportCombinedChannelScope;
}): ReportMonthlyCpaChartPoint[] {
  const { year, locale, google, meta, combinedScope } = args;
  const formatter = new Intl.DateTimeFormat(locale, { month: "short" });
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

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const googleRow = google.months.find((m) => m.month === month);
    const metaRow = meta.months.find((m) => m.month === month);
    const googleSpend = google.connected ? (googleRow?.spend ?? 0) : 0;
    const metaSpend = meta.connected ? (metaRow?.spend ?? 0) : 0;
    const googleLeads = google.connected ? (googleRow?.converted_leads ?? 0) : 0;
    const metaLeads = meta.connected ? (metaRow?.converted_leads ?? 0) : 0;
    const googleCpa = google.connected ? (googleRow?.cpa ?? null) : null;
    const metaCpa = meta.connected ? (metaRow?.cpa ?? null) : null;
    const totalLeads = combineMonthlyGoogleMeta(googleLeads, metaLeads, scope);
    const totalSpend = combineMonthlyGoogleMeta(googleSpend, metaSpend, scope);
    const totalCpa =
      canCombineCpa && totalLeads > 0 && totalSpend > 0 ? totalSpend / totalLeads : null;

    return {
      month,
      shortMonth: formatter.format(new Date(year, i, 1)),
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

export function useDigitalMarketingReportMonthlySpend(year: number | string) {
  const selectedYear = normalizeYear(year);
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { dateSelection, googleCustomerId, metaAdAccountId, filtersHydrated, reportServiceFilter } =
    useDigitalMarketingPaidAdsFilters();

  const apiServiceId = serviceFilterForApi(reportServiceFilter);

  /** Chart uses the intersection of date picker range and selected calendar year. */
  const chartDateSelection = useMemo(
    () => intersectDateSelectionWithChartYear(dateSelection, selectedYear),
    [dateSelection, selectedYear],
  );

  const chartDateOverlap = chartDateSelection != null;

  const googleReportRange = useMemo(() => {
    if (!chartDateSelection) return null;
    return toGoogleAdsMetricsDateRangePayload(chartDateSelection);
  }, [chartDateSelection]);

  const metaReportRange = useMemo(() => {
    if (!chartDateSelection) return null;
    return toMetaAdsMetricsDateRangePayload(chartDateSelection);
  }, [chartDateSelection]);

  const metaRangeWithinLookback = useMemo(() => {
    if (!chartDateSelection) return false;
    const raw = toGoogleAdsMetricsDateRangePayload(chartDateSelection);
    return raw.end >= metaAdsEarliestAllowedStartYmd();
  }, [chartDateSelection]);

  const { data: googleReportingEnabled = false, isPending: googleReportingPending } =
    useGoogleAdsReportingEnabled(organizationId);
  const { data: metaReportingEnabled = false, isPending: metaReportingPending } =
    useMetaAdsReportingEnabled(organizationId);

  const { data: googleAccounts = [], isPending: googleAccountsPending } = useQuery({
    queryKey: ["google-ads-accounts-picker-report", organizationId],
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
      "dm-report-google-monthly-spend-v9",
      organizationId,
      effectiveGoogleCustomerId,
      selectedYear,
      googleReportRange?.start,
      googleReportRange?.end,
      apiServiceId ?? "",
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
      "dm-report-meta-monthly-spend-v8",
      organizationId,
      effectiveMetaAdAccountId,
      selectedYear,
      metaReportRange?.start,
      metaReportRange?.end,
      apiServiceId ?? "",
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
      orgLoading ||
      !filtersHydrated ||
      googleReportingPending ||
      googleAccountsPending ||
      (googleReportingEnabled && googleMonthlyQuery.isLoading);
    if (!googleReportingEnabled) {
      return {
        connected: false,
        loading,
        error: null,
        currency: null,
        months: emptyMonths(),
        periodSummary: null,
      };
    }
    if (!chartDateOverlap) {
      return {
        connected: true,
        loading: false,
        error: "Date range does not overlap the selected chart year.",
        currency: null,
        months: emptyMonths(),
        periodSummary: null,
      };
    }
    if (googleMonthlyQuery.isError) {
      return {
        connected: true,
        loading: false,
        error: (googleMonthlyQuery.error as Error).message,
        currency: null,
        months: emptyMonths(),
        periodSummary: null,
      };
    }
    const data = googleMonthlyQuery.data;
    const months = normalizeMonthlyBuckets(data?.months);
    return {
      connected: true,
      loading,
      error: null,
      currency: data?.currency_code ?? data?.currency ?? "IDR",
      months,
      periodSummary: effectivePeriodSummary(months, parsePeriodSummary(data?.period_summary)),
    };
  }, [
    orgLoading,
    filtersHydrated,
    googleReportingPending,
    googleAccountsPending,
    googleReportingEnabled,
    googleMonthlyQuery,
    chartDateOverlap,
  ]);

  const metaSeries: MonthlySpendChannelSeries = useMemo(() => {
    const loading =
      orgLoading ||
      !filtersHydrated ||
      metaReportingPending ||
      metaSettingsPending ||
      (metaReportingEnabled && metaMonthlyQuery.isLoading);
    if (!metaReportingEnabled) {
      return {
        connected: false,
        loading,
        error: null,
        currency: null,
        months: emptyMonths(),
        periodSummary: null,
      };
    }
    if (!chartDateOverlap) {
      return {
        connected: true,
        loading: false,
        error: "Date range does not overlap the selected chart year.",
        currency: null,
        months: emptyMonths(),
        periodSummary: null,
      };
    }
    if (!metaRangeWithinLookback) {
      return {
        connected: true,
        loading: false,
        error: "Meta Ads data is unavailable beyond 37 months from today.",
        currency: null,
        months: emptyMonths(),
        periodSummary: null,
      };
    }
    if (metaMonthlyQuery.isError) {
      return {
        connected: true,
        loading: false,
        error: (metaMonthlyQuery.error as Error).message,
        currency: null,
        months: emptyMonths(),
        periodSummary: null,
      };
    }
    const data = metaMonthlyQuery.data;
    const months = normalizeMonthlyBuckets(data?.months);
    return {
      connected: true,
      loading,
      error: null,
      currency: normalizeMetaAdsReportCurrency(data?.currency ?? data?.currency_code),
      months,
      periodSummary: effectivePeriodSummary(months, parsePeriodSummary(data?.period_summary)),
    };
  }, [
    orgLoading,
    filtersHydrated,
    metaReportingPending,
    metaSettingsPending,
    metaReportingEnabled,
    metaMonthlyQuery,
    chartDateOverlap,
    metaRangeWithinLookback,
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
    googleSeries,
    metaSeries,
    bootstrapLoading,
    chartLoading: googleSeries.loading || metaSeries.loading,
    chartDateOverlap,
    chartDateSelection,
  };
}
