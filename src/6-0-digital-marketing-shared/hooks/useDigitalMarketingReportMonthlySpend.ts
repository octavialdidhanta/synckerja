import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
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
import { supabase } from "@/shared/lib/supabaseClient";

export type MonthlySpendBucket = {
  month: number;
  spend: number;
};

export type MonthlySpendChannelSeries = {
  connected: boolean;
  loading: boolean;
  error: string | null;
  currency: string | null;
  months: MonthlySpendBucket[];
};

export type ReportMonthlySpendChartPoint = {
  month: number;
  shortMonth: string;
  googleSpend: number;
  metaSpend: number;
  totalSpend: number;
};

export type MonthlySpendChannelFilter = "all" | "by_channel" | "google" | "meta";

type MonthlySpendApiResponse = {
  year: number;
  currency?: string | null;
  currency_code?: string | null;
  months: MonthlySpendBucket[];
  error?: string;
};

function normalizeYear(year: number | string): number {
  const n = typeof year === "string" ? Number(year) : year;
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return new Date().getFullYear();
  return Math.floor(n);
}

function emptyMonths(): MonthlySpendBucket[] {
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, spend: 0 }));
}

export function sumMonthlySpendBuckets(months: MonthlySpendBucket[]): number {
  return months.reduce((total, row) => total + (Number.isFinite(row.spend) ? row.spend : 0), 0);
}

export function buildReportYearOptions(maxYears = 6): string[] {
  const current = new Date().getFullYear();
  return Array.from({ length: maxYears }, (_, i) => String(current - i));
}

export function buildMonthlySpendChartPoints(args: {
  year: number;
  locale: string;
  google: MonthlySpendChannelSeries;
  meta: MonthlySpendChannelSeries;
}): ReportMonthlySpendChartPoint[] {
  const { year, locale, google, meta } = args;
  const formatter = new Intl.DateTimeFormat(locale, { month: "short" });

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const googleRow = google.months.find((m) => m.month === month);
    const metaRow = meta.months.find((m) => m.month === month);
    return {
      month,
      shortMonth: formatter.format(new Date(year, i, 1)),
      googleSpend: google.connected ? (googleRow?.spend ?? 0) : 0,
      metaSpend: meta.connected ? (metaRow?.spend ?? 0) : 0,
      totalSpend:
        (google.connected ? (googleRow?.spend ?? 0) : 0) +
        (meta.connected ? (metaRow?.spend ?? 0) : 0),
    };
  });
}

export function useDigitalMarketingReportMonthlySpend(year: number | string) {
  const selectedYear = normalizeYear(year);
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { dateSelection, googleCustomerId, metaAdAccountId, filtersHydrated } =
    useDigitalMarketingPaidAdsFilters();

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
      "dm-report-google-monthly-spend-v5",
      organizationId,
      effectiveGoogleCustomerId,
      selectedYear,
      googleReportRange?.start,
      googleReportRange?.end,
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
      "dm-report-meta-monthly-spend-v3",
      organizationId,
      effectiveMetaAdAccountId,
      selectedYear,
      metaReportRange?.start,
      metaReportRange?.end,
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
      };
    }
    if (!chartDateOverlap) {
      return {
        connected: true,
        loading: false,
        error: "Date range does not overlap the selected chart year.",
        currency: null,
        months: emptyMonths(),
      };
    }
    if (googleMonthlyQuery.isError) {
      return {
        connected: true,
        loading: false,
        error: (googleMonthlyQuery.error as Error).message,
        currency: null,
        months: emptyMonths(),
      };
    }
    const data = googleMonthlyQuery.data;
    return {
      connected: true,
      loading,
      error: null,
      currency: data?.currency_code ?? data?.currency ?? "IDR",
      months: data?.months?.length === 12 ? data.months : emptyMonths(),
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
      };
    }
    if (!chartDateOverlap) {
      return {
        connected: true,
        loading: false,
        error: "Date range does not overlap the selected chart year.",
        currency: null,
        months: emptyMonths(),
      };
    }
    if (!metaRangeWithinLookback) {
      return {
        connected: true,
        loading: false,
        error: "Meta Ads data is unavailable beyond 37 months from today.",
        currency: null,
        months: emptyMonths(),
      };
    }
    if (metaMonthlyQuery.isError) {
      return {
        connected: true,
        loading: false,
        error: (metaMonthlyQuery.error as Error).message,
        currency: null,
        months: emptyMonths(),
      };
    }
    const data = metaMonthlyQuery.data;
    return {
      connected: true,
      loading,
      error: null,
      currency: data?.currency ?? data?.currency_code ?? "USD",
      months: data?.months?.length === 12 ? data.months : emptyMonths(),
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
  };
}
