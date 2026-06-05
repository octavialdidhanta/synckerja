import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  isReportMetaRangeUnavailable,
  resolveReportGoogleDateRangePayload,
  resolveReportMetaDateRangePayload,
} from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
import { useGoogleAdsReportingEnabled } from "@/google-ads/hooks/useGoogleAdsReportingEnabled";
import { useGoogleAdsMetricsQuery } from "@/google-ads/hooks/useGoogleAdsMetricsQuery";
import {
  mapReportByServiceApiRows,
  type CampaignServiceAggregate,
  type ReportByServiceApiRow,
} from "@/google-ads/metrics/aggregateCampaignMetricsByService";
import {
  mapMetaReportByServiceApiRows,
  type MetaCampaignServiceAggregate,
  type MetaReportByServiceApiRow,
} from "@/meta-ads/metrics/aggregateMetaCampaignMetricsByService";
import { googleAdsAccountsReportQueryKey } from "@/6-0-digital-marketing-shared/reportQueryKeys";
import { parseEdgeFunctionError as parseGoogleEdgeError } from "@/google-ads/lib/parseEdgeFunctionError";
import { parseEdgeFunctionError as parseMetaEdgeError } from "@/meta-ads/lib/parseEdgeFunctionError";
import { useMetaAdsReportingEnabled } from "@/meta-ads/hooks/useMetaAdsReportingEnabled";
import { useMetaAdsMetricsQuery } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import { normalizeMetaAdsReportCurrency } from "@/meta-ads/lib/metaAdsReportCurrency";
import { supabase } from "@/shared/lib/supabaseClient";

export type ReportGoogleServiceRow = CampaignServiceAggregate & {
  currency: string | null;
};

export type ReportMetaServiceRow = MetaCampaignServiceAggregate & {
  currency: string | null;
};

export type ReportChannelCost = {
  amount: number | null;
  impressions: number | null;
  clicks: number | null;
  currency: string | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  accountLabel: string | null;
};

export type ReportCurrencySubtotal = {
  currency: string;
  googleAmount: number;
  metaAmount: number;
  total: number;
};

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
  loading: boolean,
  accountLabel: string | null,
  overrides?: Partial<ReportChannelCost>,
): ReportChannelCost {
  return {
    amount: 0,
    impressions: 0,
    clicks: 0,
    currency: null,
    connected: false,
    loading,
    error: null,
    accountLabel,
    ...overrides,
  };
}

export function useDigitalMarketingReportCosts() {
  const { t } = useTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { dateSelection, googleCustomerId, metaAdAccountId, filtersHydrated, reportChartYear } =
    useDigitalMarketingPaidAdsFilters();

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

  const googleDateRangePayload = useMemo(
    () =>
      resolveReportGoogleDateRangePayload(
        dateSelection,
        reportChartYear,
        googleAccountEarliestYmd,
      ),
    [dateSelection, reportChartYear, googleAccountEarliestYmd],
  );

  const metaDateRangePayload = useMemo(
    () => resolveReportMetaDateRangePayload(dateSelection, reportChartYear),
    [dateSelection, reportChartYear],
  );

  const metaRangeUnavailable = useMemo(
    () =>
      isReportMetaRangeUnavailable(
        dateSelection,
        reportChartYear,
        googleAccountEarliestYmd,
      ),
    [dateSelection, reportChartYear, googleAccountEarliestYmd],
  );

  const googleAccountLabel = useMemo(() => {
    const row = googleAccounts.find((a) => a.customer_id === effectiveGoogleCustomerId);
    return row?.label ?? (effectiveGoogleCustomerId || null);
  }, [googleAccounts, effectiveGoogleCustomerId]);

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

  const metaAccountLabel = useMemo(() => {
    const row = metricsReadyMetaAccounts.find(
      (a) => a.ad_account_id === effectiveMetaAdAccountId,
    );
    return row?.label ?? (effectiveMetaAdAccountId || null);
  }, [metricsReadyMetaAccounts, effectiveMetaAdAccountId]);

  const googleMetricsQuery = useGoogleAdsMetricsQuery(
    organizationId,
    effectiveGoogleCustomerId
      ? {
          customerId: effectiveGoogleCustomerId,
          entity: "campaign",
          metrics: ["spent", "impressions", "clicks"],
          dateRange: googleDateRangePayload,
          onlyRunning: false,
          statusFilter: "all",
          pageToken: "",
          pageSize: 1,
          sort: { field: "spent", direction: "desc" },
          summaryMetrics: ["spent", "impressions", "clicks"],
        }
      : null,
    Boolean(
      filtersHydrated &&
        organizationId &&
        googleReportingEnabled &&
        effectiveGoogleCustomerId,
    ),
  );

  const googleByServiceQuery = useQuery({
    queryKey: [
      "google-ads-report-by-service",
      organizationId,
      effectiveGoogleCustomerId,
      googleDateRangePayload,
    ],
    queryFn: async () => {
      if (!organizationId || !effectiveGoogleCustomerId) {
        throw new Error("Missing organization or customer");
      }
      const unmappedLabel = t(
        "digitalMarketing.report.serviceUnmapped",
        "Belum di-map",
      );
      const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
        body: {
          action: "fetchReportByService",
          organization_id: organizationId,
          customer_id: effectiveGoogleCustomerId,
          date_range: googleDateRangePayload,
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
    enabled: Boolean(
      filtersHydrated &&
        organizationId &&
        googleReportingEnabled &&
        effectiveGoogleCustomerId,
    ),
    staleTime: 10 * 60 * 1000,
  });

  const metaMetricsQuery = useMetaAdsMetricsQuery({
    organizationId,
    adAccountId: effectiveMetaAdAccountId,
    entity: "campaign",
    dateStart: metaDateRangePayload.start,
    dateEnd: metaDateRangePayload.end,
    enabled: Boolean(
      filtersHydrated &&
        organizationId &&
        metaReportingEnabled &&
        effectiveMetaAdAccountId &&
        !metaRangeUnavailable,
    ),
  });

  const metaByServiceQuery = useQuery({
    queryKey: [
      "meta-ads-report-by-service",
      organizationId,
      effectiveMetaAdAccountId,
      metaDateRangePayload.start,
      metaDateRangePayload.end,
    ],
    queryFn: async () => {
      if (!organizationId || !effectiveMetaAdAccountId) {
        throw new Error("Missing organization or ad account");
      }
      const unmappedLabel = t(
        "digitalMarketing.report.serviceUnmapped",
        "Belum di-map",
      );
      const { data, error } = await supabase.functions.invoke("meta-ads-metrics", {
        body: {
          action: "fetchReportByService",
          organization_id: organizationId,
          ad_account_id: effectiveMetaAdAccountId,
          date_start: metaDateRangePayload.start,
          date_end: metaDateRangePayload.end,
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
    enabled: Boolean(
      filtersHydrated &&
        organizationId &&
        metaReportingEnabled &&
        effectiveMetaAdAccountId &&
        !metaRangeUnavailable,
    ),
    staleTime: 10 * 60 * 1000,
  });

  const googleCost: ReportChannelCost = useMemo(() => {
    const loading =
      orgLoading ||
      !filtersHydrated ||
      googleReportingPending ||
      googleAccountsPending ||
      (googleReportingEnabled && googleMetricsQuery.isLoading);
    if (!googleReportingEnabled) {
      return emptyChannelStats(loading, googleAccountLabel);
    }
    if (googleMetricsQuery.isError) {
      return emptyChannelStats(loading, googleAccountLabel, {
        connected: true,
        loading: false,
        amount: null,
        impressions: null,
        clicks: null,
        error: (googleMetricsQuery.error as Error).message,
      });
    }
    const totals = googleMetricsQuery.data?.summary_totals;
    return {
      amount: readGoogleSummaryMetric(totals, "spent") ?? 0,
      impressions: readGoogleSummaryMetric(totals, "impressions") ?? 0,
      clicks: readGoogleSummaryMetric(totals, "clicks") ?? 0,
      currency: googleMetricsQuery.data?.currency_code ?? "IDR",
      connected: true,
      loading,
      error: null,
      accountLabel: googleAccountLabel,
    };
  }, [
    orgLoading,
    filtersHydrated,
    googleReportingPending,
    googleAccountsPending,
    googleReportingEnabled,
    googleMetricsQuery,
    googleAccountLabel,
  ]);

  const metaCost: ReportChannelCost = useMemo(() => {
    const loading =
      orgLoading ||
      !filtersHydrated ||
      metaReportingPending ||
      metaSettingsPending ||
      (metaReportingEnabled && metaMetricsQuery.isLoading);
    if (!metaReportingEnabled) {
      return emptyChannelStats(loading, metaAccountLabel);
    }
    if (!effectiveMetaAdAccountId) {
      return emptyChannelStats(loading, null, { connected: true });
    }
    if (metaRangeUnavailable) {
      return emptyChannelStats(false, metaAccountLabel, {
        connected: true,
        loading: false,
        amount: null,
        impressions: null,
        clicks: null,
        error: "Meta Ads data is unavailable beyond 37 months from today.",
      });
    }
    if (metaMetricsQuery.isError) {
      return emptyChannelStats(loading, metaAccountLabel, {
        connected: true,
        loading: false,
        amount: null,
        impressions: null,
        clicks: null,
        error: (metaMetricsQuery.error as Error).message,
      });
    }
    const summary = metaMetricsQuery.data?.summary;
    const spend = summary?.spend;
    const impressions = summary?.impressions;
    const clicks = summary?.clicks;
    return {
      amount: spend != null && Number.isFinite(spend) ? spend : 0,
      impressions:
        impressions != null && Number.isFinite(impressions) ? impressions : 0,
      clicks: clicks != null && Number.isFinite(clicks) ? clicks : 0,
      currency: normalizeMetaAdsReportCurrency(summary?.currency),
      connected: true,
      loading,
      error: null,
      accountLabel: metaAccountLabel,
    };
  }, [
    orgLoading,
    filtersHydrated,
    metaReportingPending,
    metaSettingsPending,
    metaReportingEnabled,
    metaMetricsQuery,
    effectiveMetaAdAccountId,
    metaAccountLabel,
    metaRangeUnavailable,
  ]);

  const currencySubtotals: ReportCurrencySubtotal[] = useMemo(() => {
    const map = new Map<string, { google: number; meta: number }>();
    const add = (currency: string | null, channel: "google" | "meta", amount: number) => {
      if (!currency || !Number.isFinite(amount)) return;
      const code = currency.toUpperCase();
      const prev = map.get(code) ?? { google: 0, meta: 0 };
      if (channel === "google") prev.google += amount;
      else prev.meta += amount;
      map.set(code, prev);
    };
    if (googleCost.connected && googleCost.amount != null) {
      add(googleCost.currency, "google", googleCost.amount);
    }
    if (metaCost.connected && metaCost.amount != null) {
      add(metaCost.currency, "meta", metaCost.amount);
    }
    return [...map.entries()]
      .map(([currency, v]) => ({
        currency,
        googleAmount: v.google,
        metaAmount: v.meta,
        total: v.google + v.meta,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
  }, [googleCost, metaCost]);

  const totalImpressions = useMemo(() => {
    let google = 0;
    let meta = 0;
    if (googleCost.connected && googleCost.impressions != null) {
      google = googleCost.impressions;
    }
    if (metaCost.connected && metaCost.impressions != null) {
      meta = metaCost.impressions;
    }
    return {
      google,
      meta,
      total: google + meta,
      loading: googleCost.loading || metaCost.loading,
    };
  }, [googleCost, metaCost]);

  const googleServicesLoading = useMemo(() => {
    if (!googleReportingEnabled || !effectiveGoogleCustomerId) return false;
    return (
      !filtersHydrated ||
      googleByServiceQuery.isLoading ||
      googleByServiceQuery.isPending
    );
  }, [
    googleReportingEnabled,
    effectiveGoogleCustomerId,
    filtersHydrated,
    googleByServiceQuery.isLoading,
    googleByServiceQuery.isPending,
  ]);

  const googleServiceRows: ReportGoogleServiceRow[] = useMemo(() => {
    if (!googleReportingEnabled || !googleCost.connected) return [];
    const currency =
      googleByServiceQuery.data?.currencyCode ??
      googleCost.currency ??
      "IDR";
    const aggregates = googleByServiceQuery.data?.aggregates ?? [];
    return aggregates.map((row) => ({
      ...row,
      currency,
    }));
  }, [
    googleReportingEnabled,
    googleCost.connected,
    googleCost.currency,
    googleByServiceQuery.data,
  ]);

  const metaServicesLoading = useMemo(() => {
    if (!metaReportingEnabled || !effectiveMetaAdAccountId || metaRangeUnavailable) {
      return false;
    }
    return (
      !filtersHydrated ||
      metaByServiceQuery.isLoading ||
      metaByServiceQuery.isPending
    );
  }, [
    metaReportingEnabled,
    effectiveMetaAdAccountId,
    metaRangeUnavailable,
    filtersHydrated,
    metaByServiceQuery.isLoading,
    metaByServiceQuery.isPending,
  ]);

  const metaServiceRows: ReportMetaServiceRow[] = useMemo(() => {
    if (!metaReportingEnabled || !metaCost.connected || metaCost.error) return [];
    const currency =
      normalizeMetaAdsReportCurrency(
        metaByServiceQuery.data?.currencyCode ?? metaCost.currency,
      );
    const aggregates = metaByServiceQuery.data?.aggregates ?? [];
    return aggregates.map((row) => ({
      ...row,
      currency,
    }));
  }, [
    metaReportingEnabled,
    metaCost.connected,
    metaCost.error,
    metaCost.currency,
    metaByServiceQuery.data,
  ]);

  const pageLoading =
    orgLoading ||
    !filtersHydrated ||
    googleReportingPending ||
    metaReportingPending ||
    googleAccountsPending ||
    metaSettingsPending ||
    (googleReportingEnabled &&
      Boolean(effectiveGoogleCustomerId) &&
      googleServicesLoading) ||
    (metaReportingEnabled &&
      Boolean(effectiveMetaAdAccountId) &&
      !metaRangeUnavailable &&
      metaServicesLoading);

  return {
    googleCost,
    metaCost,
    googleServiceRows,
    googleServicesLoading,
    metaServiceRows,
    metaServicesLoading,
    googleServicesError: googleByServiceQuery.isError
      ? (googleByServiceQuery.error as Error).message
      : null,
    metaServicesError: metaByServiceQuery.isError
      ? (metaByServiceQuery.error as Error).message
      : null,
    currencySubtotals,
    totalImpressions,
    pageLoading,
    effectiveGoogleCustomerId,
    effectiveMetaAdAccountId,
  };
}
