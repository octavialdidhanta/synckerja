import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { toGoogleAdsMetricsDateRangePayload } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { metaAdsEarliestAllowedStartYmd } from "@/meta-ads/lib/clampMetaAdsDateRange";
import { toMetaAdsMetricsDateRangePayload } from "@/meta-ads/lib/toMetaAdsMetricsDateRangePayload";
import { useGoogleAdsReportingEnabled } from "@/google-ads/hooks/useGoogleAdsReportingEnabled";
import { useGoogleAdsMetricsQuery } from "@/google-ads/hooks/useGoogleAdsMetricsQuery";
import { useMetaAdsReportingEnabled } from "@/meta-ads/hooks/useMetaAdsReportingEnabled";
import { useMetaAdsMetricsQuery } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import { supabase } from "@/shared/lib/supabaseClient";

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
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { dateSelection, googleCustomerId, metaAdAccountId, filtersHydrated } =
    useDigitalMarketingPaidAdsFilters();

  /** Table always follows the shared date picker. */
  const googleDateRangePayload = useMemo(
    () => toGoogleAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );
  const metaDateRangePayload = useMemo(
    () => toMetaAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );

  const metaRangeUnavailable = useMemo(() => {
    const raw = toGoogleAdsMetricsDateRangePayload(dateSelection);
    return raw.end < metaAdsEarliestAllowedStartYmd();
  }, [dateSelection]);

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
      currency: summary?.currency ?? "USD",
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

  const pageLoading =
    orgLoading ||
    !filtersHydrated ||
    googleReportingPending ||
    metaReportingPending ||
    googleAccountsPending ||
    metaSettingsPending;

  return {
    googleCost,
    metaCost,
    currencySubtotals,
    totalImpressions,
    pageLoading,
    effectiveGoogleCustomerId,
    effectiveMetaAdAccountId,
  };
}
