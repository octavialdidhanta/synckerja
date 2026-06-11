import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { useCallback, useMemo } from "react";
import { buildDmAccountActuals } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import {
  googleApiKeysForReportMetrics,
  metaTikTokNeedsCampaignRows,
} from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import {
  periodKeyToDateRangePayload,
  resolvePeriodKeyToBounds,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import { dmReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/dmReportTargetQueryKeys";
import {
  channelMetricsForAccount,
  hasAnyChannelMetrics,
  type DmReportChannelMetricsMap,
} from "@/6-0-digital-marketing-shared/dmReportTargetMetricsByChannel";
import {
  dmTargetAccountKey,
  type DmAccountPeriodActuals,
  type DmReportTargetAccountRef,
  type DmReportTargetPeriodKey,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useDmReportTargetAccounts } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetAccounts";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { fetchGoogleAdsMetrics } from "@/google-ads/hooks/useGoogleAdsMetricsQuery";
import { fetchMetaAdsMetrics } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { fetchTikTokAdsMetrics } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";

const CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function fetchDmReportAccountActuals(
  organizationId: string,
  account: DmReportTargetAccountRef,
  dateStart: string,
  dateEnd: string,
  selectedMetricKeys: string[],
): Promise<DmAccountPeriodActuals> {
  const empty = buildDmAccountActuals({
    channel: account.channel,
    accountId: account.accountId,
    selectedMetricKeys,
    connected: false,
    currencyCode: account.currencyCode,
  });

  try {
    if (account.channel === "google") {
      const apiMetrics = googleApiKeysForReportMetrics(selectedMetricKeys);
      const response = await fetchGoogleAdsMetrics(organizationId, {
        customerId: account.accountId,
        entity: "campaign",
        metrics: apiMetrics,
        dateRange: { start: dateStart, end: dateEnd },
        onlyRunning: false,
        statusFilter: "all",
        pageToken: "",
        pageSize: 1,
        sort: { field: "spent", direction: "desc" },
        summaryMetrics: apiMetrics,
      });
      return buildDmAccountActuals({
        channel: "google",
        accountId: account.accountId,
        selectedMetricKeys,
        connected: true,
        currencyCode: response.currency_code ?? account.currencyCode,
        googleTotals: response.summary_totals ?? null,
      });
    }

    const needsRows = metaTikTokNeedsCampaignRows(selectedMetricKeys);

    const response =
      account.channel === "meta"
        ? await fetchMetaAdsMetrics({
            organizationId,
            adAccountId: account.accountId,
            entity: "campaign",
            dateStart,
            dateEnd,
          })
        : await fetchTikTokAdsMetrics({
            organizationId,
            advertiserId: account.accountId,
            entity: "campaign",
            dateStart,
            dateEnd,
          });

    return buildDmAccountActuals({
      channel: account.channel,
      accountId: account.accountId,
      selectedMetricKeys,
      connected: true,
      currencyCode: response.summary?.currency ?? account.currencyCode,
      metaTikTokSummary: response.summary,
      metaTikTokRows: needsRows ? response.rows : [],
    });
  } catch {
    return empty;
  }
}

function serializeMetricsByChannel(map: DmReportChannelMetricsMap): string {
  return JSON.stringify(map);
}

export function useDmReportPeriodActuals(
  period: DmReportTargetPeriodKey | null,
  selectedMetricsByChannel: DmReportChannelMetricsMap,
) {
  const { organizationId } = useCurrentOrg();
  const { accounts } = useDmReportTargetAccounts();

  const bounds = useMemo(
    () => (period ? resolvePeriodKeyToBounds(period) : null),
    [period],
  );

  const datePayload = useMemo(
    () => (period ? periodKeyToDateRangePayload(period) : null),
    [period],
  );

  const periodNotStarted = useMemo(() => {
    if (!bounds) return false;
    const today = startOfDay(new Date());
    return today.getTime() < startOfDay(bounds.periodStart).getTime();
  }, [bounds]);

  const accountKeys = useMemo(
    () => accounts.map((a) => dmTargetAccountKey(a.channel, a.accountId)),
    [accounts],
  );

  const query = useQuery({
    queryKey: dmReportTargetQueryKeys.actuals(
      organizationId,
      period,
      [serializeMetricsByChannel(selectedMetricsByChannel)],
      accountKeys,
    ),
    queryFn: async (): Promise<Map<string, DmAccountPeriodActuals>> => {
      if (!organizationId || !period || !datePayload || !hasAnyChannelMetrics(selectedMetricsByChannel)) {
        return new Map();
      }

      const accountsToFetch = accounts.filter(
        (a) => channelMetricsForAccount(selectedMetricsByChannel, a.channel).length > 0,
      );

      const results = await mapWithConcurrency(accountsToFetch, CONCURRENCY, (account) =>
        fetchDmReportAccountActuals(
          organizationId,
          account,
          datePayload.start,
          datePayload.end,
          channelMetricsForAccount(selectedMetricsByChannel, account.channel),
        ),
      );

      const map = new Map<string, DmAccountPeriodActuals>();
      for (const actuals of results) {
        map.set(dmTargetAccountKey(actuals.channel, actuals.accountId), actuals);
      }
      return map;
    },
    enabled: Boolean(
      organizationId &&
        period &&
        hasAnyChannelMetrics(selectedMetricsByChannel) &&
        accounts.length > 0,
    ),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const getAccountActuals = useCallback(
    (account: DmReportTargetAccountRef): DmAccountPeriodActuals => {
      const key = dmTargetAccountKey(account.channel, account.accountId);
      const found = query.data?.get(key);
      if (found) return found;
      return buildDmAccountActuals({
        channel: account.channel,
        accountId: account.accountId,
        selectedMetricKeys: channelMetricsForAccount(selectedMetricsByChannel, account.channel),
        connected: false,
        currencyCode: account.currencyCode,
      });
    },
    [query.data, selectedMetricsByChannel],
  );

  return {
    actualsByAccount: query.data ?? new Map<string, DmAccountPeriodActuals>(),
    getAccountActuals,
    inProgress: datePayload?.inProgress ?? false,
    periodNotStarted,
    isLoading: query.isLoading,
    wasDateClamped: false,
  };
}
