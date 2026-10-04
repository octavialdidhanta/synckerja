import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import type { ReportChartSpanMode } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import {
  aggregateMetaProductPurchases,
  buildServiceConvertedChartPoints,
} from "@/6-0-digital-marketing-shared/reportMonthlyLeadsByService";
import { buildReportServiceSpendSeriesList } from "@/6-0-digital-marketing-shared/reportMonthlySpendByService";
import { resolveReportMetaDateRangePayload } from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";
import { fetchMetaAdsMetrics } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import { supabase } from "@/shared/lib/supabaseClient";
import type { ReportGoogleServiceRow } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import type { ReportMetaServiceRow } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";

const LEAD_PAGE_SIZE = 1000;

function normalizeYear(year: number | string): number {
  const n = typeof year === "string" ? Number(year) : year;
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return new Date().getFullYear();
  return Math.floor(n);
}

/** Inclusive local-calendar bounds for a YYYY-MM-DD pair. */
function localYmdStartIso(ymd: string): string {
  const [year, month, day] = ymd.split("-").map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0).toISOString();
}

function localYmdEndIso(ymd: string): string {
  const [year, month, day] = ymd.split("-").map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999).toISOString();
}

async function fetchConvertedLeadServiceValues(
  organizationId: string,
  dateStart: string,
  dateEnd: string,
): Promise<string[]> {
  const { data: statuses, error: statusError } = await supabase
    .from("lead_statuses")
    .select("id, name")
    .eq("is_active", true);
  if (statusError) throw statusError;

  const statusIds = (statuses ?? [])
    .filter((row) => String(row.name ?? "").trim().toLowerCase() === "converted")
    .map((row) => row.id);
  if (statusIds.length === 0) return [];

  const startIso = localYmdStartIso(dateStart);
  const endIso = localYmdEndIso(dateEnd);
  const values: string[] = [];

  for (let from = 0; from < 20_000; from += LEAD_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("leads")
      .select("services")
      .eq("organization_id", organizationId)
      .in("status_id", statusIds)
      .is("merged_into_lead_id", null)
      .gte("converted_at", startIso)
      .lte("converted_at", endIso)
      .range(from, from + LEAD_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) values.push(String(row.services ?? ""));
    if (rows.length < LEAD_PAGE_SIZE) break;
  }

  return values;
}

export function useDigitalMarketingReportMonthlyLeadsByService(args: {
  enabled: boolean;
  selectedYear: number | string;
  chartSpanMode: ReportChartSpanMode;
  googleServiceRows: ReportGoogleServiceRow[];
  metaServiceRows: ReportMetaServiceRow[];
  unmappedLabel: string;
  noServiceLabel: string;
  chartDateOverlap: boolean;
}) {
  const {
    enabled,
    selectedYear: yearInput,
    googleServiceRows,
    metaServiceRows,
    unmappedLabel,
    noServiceLabel,
    chartDateOverlap,
  } = args;

  const selectedYear = normalizeYear(yearInput);
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { dateSelection, filtersHydrated, metaAdAccountId, monthlyChartChannelFilter } =
    useDigitalMarketingPaidAdsFilters();
  const includeProductPurchases =
    monthlyChartChannelFilter !== "google" && monthlyChartChannelFilter !== "tiktok";

  const adServices = useMemo(
    () =>
      enabled
        ? buildReportServiceSpendSeriesList(googleServiceRows, metaServiceRows, unmappedLabel)
        : [],
    [enabled, googleServiceRows, metaServiceRows, unmappedLabel],
  );

  const reportRange = useMemo(
    () => resolveReportMetaDateRangePayload(dateSelection, selectedYear),
    [dateSelection, selectedYear],
  );

  const queryEnabled = Boolean(
    enabled &&
      filtersHydrated &&
      organizationId &&
      chartDateOverlap &&
      reportRange.start &&
      reportRange.end,
  );

  const catalogQuery = useQuery({
    queryKey: ["dm-report-service-catalog", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
    enabled: queryEnabled,
    staleTime: 60_000,
  });

  const { data: metaSettings, isPending: metaSettingsPending } = useMetaAdsSettings(organizationId, {
    enabled: Boolean(queryEnabled && includeProductPurchases && !metaAdAccountId),
  });

  const effectiveMetaAdAccountId = useMemo(() => {
    if (metaAdAccountId) return metaAdAccountId;
    const accounts = metaSettings?.oauthConnected
      ? (metaSettings.accounts ?? []).filter((account) => account.is_active && account.pixel_id !== "0")
      : [];
    return (accounts.find((account) => account.is_default) ?? accounts[0])?.ad_account_id ?? "";
  }, [metaAdAccountId, metaSettings?.accounts, metaSettings?.oauthConnected]);

  const purchasesQuery = useQuery({
    queryKey: [
      "dm-report-service-product-purchases-v1",
      organizationId,
      effectiveMetaAdAccountId,
      reportRange.start,
      reportRange.end,
    ],
    queryFn: async () => {
      const rows: Array<Record<string, unknown>> = [];
      let pageToken = "";
      for (let page = 0; page < 20; page += 1) {
        const payload = await fetchMetaAdsMetrics({
          organizationId: organizationId!,
          adAccountId: effectiveMetaAdAccountId,
          entity: "campaign",
          dateStart: reportRange.start,
          dateEnd: reportRange.end,
          pageToken,
        });
        rows.push(...((payload.rows ?? []) as Array<Record<string, unknown>>));
        if (!payload.next_page_token) break;
        pageToken = payload.next_page_token;
      }
      return aggregateMetaProductPurchases(rows);
    },
    enabled: Boolean(queryEnabled && includeProductPurchases && effectiveMetaAdAccountId),
    staleTime: 60_000,
  });

  const leadsQuery = useQuery({
    queryKey: [
      "dm-report-service-converted-leads-v1",
      organizationId,
      reportRange.start,
      reportRange.end,
    ],
    queryFn: () =>
      fetchConvertedLeadServiceValues(organizationId!, reportRange.start, reportRange.end),
    enabled: queryEnabled,
    staleTime: 60_000,
  });

  const purchasesPending =
    queryEnabled &&
    includeProductPurchases &&
    (metaSettingsPending && !metaAdAccountId ? true : purchasesQuery.isLoading);

  const loading = Boolean(
    enabled &&
      (orgLoading ||
        !filtersHydrated ||
        (queryEnabled && (catalogQuery.isLoading || leadsQuery.isLoading || purchasesPending))),
  );

  const error = catalogQuery.isError
    ? (catalogQuery.error as Error).message
    : leadsQuery.isError
      ? (leadsQuery.error as Error).message
      : purchasesQuery.isError
        ? (purchasesQuery.error as Error).message
        : null;

  const chartData = useMemo(
    () =>
      enabled
        ? buildServiceConvertedChartPoints({
            adServices,
            catalog: catalogQuery.data ?? [],
            leadServiceValues: leadsQuery.data ?? [],
            productPurchases: includeProductPurchases ? (purchasesQuery.data ?? []) : [],
            noServiceLabel,
            unmappedLabel,
          })
        : [],
    [
      enabled,
      adServices,
      catalogQuery.data,
      leadsQuery.data,
      purchasesQuery.data,
      includeProductPurchases,
      noServiceLabel,
      unmappedLabel,
    ],
  );

  return {
    chartData,
    loading,
    error,
  };
}
