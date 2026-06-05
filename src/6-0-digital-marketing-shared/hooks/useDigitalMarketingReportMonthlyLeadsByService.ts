import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import type {
  MonthlySpendBucket,
  ReportChartSpanMode,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import {
  aggregateServiceLeadsByCalendarMonth,
  buildLeadsByServiceTotalsChartPoints,
  buildReportServiceLeadsSeriesList,
  sumMonthlyLeadsForChannelFilter,
  type ReportServiceLeadsSeries,
} from "@/6-0-digital-marketing-shared/reportMonthlyLeadsByService";
import { serviceIdForMonthlyApi } from "@/6-0-digital-marketing-shared/reportMonthlySpendByService";
import {
  isReportMetaRangeUnavailable,
  resolveReportGoogleDateRangePayload,
  resolveReportMetaDateRangePayload,
} from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";
import { useGoogleAdsReportingEnabled } from "@/google-ads/hooks/useGoogleAdsReportingEnabled";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
import { useMetaAdsReportingEnabled } from "@/meta-ads/hooks/useMetaAdsReportingEnabled";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import { parseEdgeFunctionError as parseGoogleEdgeError } from "@/google-ads/lib/parseEdgeFunctionError";
import { parseEdgeFunctionError as parseMetaEdgeError } from "@/meta-ads/lib/parseEdgeFunctionError";
import { googleAdsAccountsReportQueryKey } from "@/6-0-digital-marketing-shared/reportQueryKeys";
import { supabase } from "@/shared/lib/supabaseClient";
import type { ReportGoogleServiceRow } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import type { ReportMetaServiceRow } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";

type MonthlySpendApiResponse = {
  year?: number;
  currency?: string | null;
  currency_code?: string | null;
  months?: MonthlySpendBucket[];
  error?: string;
};

type ServiceMonthlyQueryResult = {
  dataKey: string;
  googleMonths: MonthlySpendBucket[];
  metaMonths: MonthlySpendBucket[];
};

function normalizeYear(year: number | string): number {
  const n = typeof year === "string" ? Number(year) : year;
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return new Date().getFullYear();
  return Math.floor(n);
}

function normalizeMonthlyBuckets(
  raw: MonthlySpendBucket[] | undefined,
  fallbackYear: number,
): MonthlySpendBucket[] {
  if (!raw?.length) return [];
  const hasYear = raw.some((r) => r.year != null && Number.isFinite(Number(r.year)));
  if (hasYear) {
    return raw.map((r) => ({
      year: Number(r.year),
      month: r.month,
      spend: r.spend ?? 0,
      converted_leads: r.converted_leads ?? 0,
    }));
  }
  return raw.map((r) => ({
    year: fallbackYear,
    month: r.month,
    spend: r.spend ?? 0,
    converted_leads: r.converted_leads ?? 0,
  }));
}

function applySpanModeMonths(
  rows: MonthlySpendBucket[],
  spanMode: ReportChartSpanMode,
): MonthlySpendBucket[] {
  if (spanMode === "all_time") return aggregateServiceLeadsByCalendarMonth(rows);
  return rows;
}

export function useDigitalMarketingReportMonthlyLeadsByService(args: {
  enabled: boolean;
  selectedYear: number | string;
  chartSpanMode: ReportChartSpanMode;
  googleServiceRows: ReportGoogleServiceRow[];
  metaServiceRows: ReportMetaServiceRow[];
  unmappedLabel: string;
  chartDateOverlap: boolean;
}) {
  const {
    enabled,
    selectedYear: yearInput,
    chartSpanMode,
    googleServiceRows,
    metaServiceRows,
    unmappedLabel,
    chartDateOverlap,
  } = args;

  const selectedYear = normalizeYear(yearInput);
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const {
    dateSelection,
    googleCustomerId,
    metaAdAccountId,
    filtersHydrated,
    monthlyChartChannelFilter,
  } = useDigitalMarketingPaidAdsFilters();

  const services = useMemo(
    () =>
      enabled
        ? buildReportServiceLeadsSeriesList(googleServiceRows, metaServiceRows, unmappedLabel)
        : [],
    [enabled, googleServiceRows, metaServiceRows, unmappedLabel],
  );

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
    enabled: Boolean(organizationId && enabled),
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
    Boolean(organizationId && effectiveGoogleCustomerId && enabled),
  );

  const googleAccountEarliestYmd = accountDateBounds?.earliest_date ?? null;

  const googleReportRange = useMemo(
    () =>
      resolveReportGoogleDateRangePayload(
        dateSelection,
        selectedYear,
        googleAccountEarliestYmd,
      ),
    [dateSelection, selectedYear, googleAccountEarliestYmd],
  );

  const metaReportRange = useMemo(
    () => resolveReportMetaDateRangePayload(dateSelection, selectedYear),
    [dateSelection, selectedYear],
  );

  const metaRangeWithinLookback = useMemo(
    () =>
      !isReportMetaRangeUnavailable(
        dateSelection,
        selectedYear,
        googleAccountEarliestYmd,
      ),
    [dateSelection, selectedYear, googleAccountEarliestYmd],
  );

  const { data: metaSettings, isPending: metaSettingsPending } = useMetaAdsSettings(
    organizationId,
    { enabled: Boolean(organizationId && enabled) },
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

  const fetchGoogleEnabled = Boolean(
    enabled &&
      filtersHydrated &&
      organizationId &&
      googleReportingEnabled &&
      effectiveGoogleCustomerId &&
      chartDateOverlap &&
      googleReportRange,
  );

  const fetchMetaEnabled = Boolean(
    enabled &&
      filtersHydrated &&
      organizationId &&
      metaReportingEnabled &&
      effectiveMetaAdAccountId &&
      chartDateOverlap &&
      metaReportRange &&
      metaRangeWithinLookback,
  );

  const serviceQueries = useQueries({
    queries: services.map((svc) => ({
      queryKey: [
        "dm-report-monthly-leads-by-service-v1",
        organizationId,
        effectiveGoogleCustomerId,
        effectiveMetaAdAccountId,
        selectedYear,
        googleReportRange?.start,
        googleReportRange?.end,
        metaReportRange?.start,
        metaReportRange?.end,
        svc.dataKey,
        serviceIdForMonthlyApi(svc.serviceId),
        monthlyChartChannelFilter,
      ],
      queryFn: async (): Promise<ServiceMonthlyQueryResult> => {
        const apiServiceId = serviceIdForMonthlyApi(svc.serviceId);
        let googleMonths: MonthlySpendBucket[] = [];
        let metaMonths: MonthlySpendBucket[] = [];

        if (fetchGoogleEnabled && monthlyChartChannelFilter !== "meta") {
          const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
            body: {
              action: "fetchMonthlySpend",
              organization_id: organizationId,
              customer_id: effectiveGoogleCustomerId,
              year: selectedYear,
              date_start: googleReportRange!.start,
              date_end: googleReportRange!.end,
              service_id: apiServiceId,
            },
          });
          if (error) throw await parseGoogleEdgeError(error, data);
          const payload = data as MonthlySpendApiResponse;
          if (payload?.error) throw await parseGoogleEdgeError(null, payload);
          googleMonths = normalizeMonthlyBuckets(payload?.months, selectedYear);
        }

        if (fetchMetaEnabled && monthlyChartChannelFilter !== "google") {
          const { data, error } = await supabase.functions.invoke("meta-ads-metrics", {
            body: {
              organization_id: organizationId,
              ad_account_id: effectiveMetaAdAccountId,
              monthly_breakdown: true,
              year: selectedYear,
              date_start: metaReportRange!.start,
              date_end: metaReportRange!.end,
              service_id: apiServiceId,
            },
          });
          if (error) throw await parseMetaEdgeError(error, data);
          const payload = data as MonthlySpendApiResponse;
          if (payload?.error) throw await parseMetaEdgeError(null, payload);
          metaMonths = normalizeMonthlyBuckets(payload?.months, selectedYear);
        }

        return {
          dataKey: svc.dataKey,
          googleMonths: applySpanModeMonths(googleMonths, chartSpanMode),
          metaMonths: applySpanModeMonths(metaMonths, chartSpanMode),
        };
      },
      enabled: Boolean(
        enabled &&
          filtersHydrated &&
          organizationId &&
          (fetchGoogleEnabled || fetchMetaEnabled) &&
          services.length > 0,
      ),
      staleTime: 10 * 60 * 1000,
    })),
  });

  const loading = useMemo(() => {
    if (!enabled) return false;
    return (
      orgLoading ||
      !filtersHydrated ||
      googleReportingPending ||
      metaReportingPending ||
      googleAccountsPending ||
      metaSettingsPending ||
      serviceQueries.some((q) => q.isLoading)
    );
  }, [
    enabled,
    orgLoading,
    filtersHydrated,
    googleReportingPending,
    metaReportingPending,
    googleAccountsPending,
    metaSettingsPending,
    serviceQueries,
  ]);

  const error = useMemo(() => {
    const failed = serviceQueries.find((q) => q.isError);
    return failed ? (failed.error as Error).message : null;
  }, [serviceQueries]);

  const leadsByServiceKey = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const q of serviceQueries) {
      if (!q.data) continue;
      const leadsMap = sumMonthlyLeadsForChannelFilter(
        q.data.googleMonths,
        q.data.metaMonths,
        selectedYear,
        monthlyChartChannelFilter,
        chartSpanMode,
      );
      map.set(q.data.dataKey, leadsMap);
    }
    return map;
  }, [serviceQueries, selectedYear, monthlyChartChannelFilter, chartSpanMode]);

  const chartData = useMemo(
    () =>
      enabled ? buildLeadsByServiceTotalsChartPoints(services, leadsByServiceKey) : [],
    [enabled, services, leadsByServiceKey],
  );

  return {
    services: services as ReportServiceLeadsSeries[],
    chartData,
    loading,
    error,
  };
}
