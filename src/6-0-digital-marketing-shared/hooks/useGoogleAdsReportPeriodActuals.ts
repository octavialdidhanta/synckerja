import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { useCallback, useMemo } from "react";
import { buildAccountActuals } from "@/6-0-digital-marketing-shared/googleAdsReportTargetActuals";
import {
  periodKeyToDateRangePayload,
  resolvePeriodKeyToBounds,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetPeriod";
import { googleAdsReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/googleAdsReportTargetQueryKeys";
import type {
  GoogleAdsAccountPeriodActuals,
  GoogleAdsReportTargetAccountRef,
  GoogleAdsReportTargetPeriodKey,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import { useGoogleAdsReportTargetAccounts } from "@/6-0-digital-marketing-shared/hooks/useGoogleAdsReportTargetAccounts";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { fetchGoogleAdsMetrics } from "@/google-ads/hooks/useGoogleAdsMetricsQuery";
import type { MetricValueKind } from "@/google-ads/metrics/types";

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

async function fetchAccountActuals(
  organizationId: string,
  account: GoogleAdsReportTargetAccountRef,
  dateStart: string,
  dateEnd: string,
  selectedMetricKeys: string[],
  valueKinds: Record<string, MetricValueKind>,
): Promise<GoogleAdsAccountPeriodActuals> {
  try {
    const metrics = selectedMetricKeys.length > 0 ? selectedMetricKeys : ["spent"];
    const response = await fetchGoogleAdsMetrics(organizationId, {
      customerId: account.customerId,
      entity: "campaign",
      metrics,
      dateRange: { start: dateStart, end: dateEnd },
      onlyRunning: false,
      statusFilter: "all",
      pageToken: "",
      pageSize: 1,
      sort: { field: "spent", direction: "desc" },
      summaryMetrics: metrics,
    });

    return buildAccountActuals(
      account.customerId,
      response.summary_totals ?? null,
      selectedMetricKeys,
      valueKinds,
      true,
    );
  } catch {
    return buildAccountActuals(
      account.customerId,
      null,
      selectedMetricKeys,
      valueKinds,
      true,
    );
  }
}

export function useGoogleAdsReportPeriodActuals(
  period: GoogleAdsReportTargetPeriodKey | null,
  selectedMetricKeys: string[],
  valueKinds: Record<string, MetricValueKind>,
) {
  const { organizationId } = useCurrentOrg();
  const { accounts } = useGoogleAdsReportTargetAccounts();

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

  const customerIds = useMemo(() => accounts.map((a) => a.customerId), [accounts]);

  const query = useQuery({
    queryKey: googleAdsReportTargetQueryKeys.actuals(
      organizationId,
      period,
      selectedMetricKeys,
      customerIds,
    ),
    queryFn: async (): Promise<Map<string, GoogleAdsAccountPeriodActuals>> => {
      if (!organizationId || !period || !datePayload || selectedMetricKeys.length === 0) {
        return new Map();
      }

      const results = await mapWithConcurrency(accounts, CONCURRENCY, (account) =>
        fetchAccountActuals(
          organizationId,
          account,
          datePayload.start,
          datePayload.end,
          selectedMetricKeys,
          valueKinds,
        ),
      );

      const map = new Map<string, GoogleAdsAccountPeriodActuals>();
      for (const actuals of results) {
        map.set(actuals.customerId, actuals);
      }
      return map;
    },
    enabled: Boolean(
      organizationId && period && selectedMetricKeys.length > 0 && accounts.length > 0,
    ),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const getAccountActuals = useCallback(
    (customerId: string): GoogleAdsAccountPeriodActuals => {
      const found = query.data?.get(customerId);
      if (found) return found;
      return buildAccountActuals(customerId, null, selectedMetricKeys, valueKinds, false);
    },
    [query.data, selectedMetricKeys, valueKinds],
  );

  return {
    actualsByAccount: query.data ?? new Map<string, GoogleAdsAccountPeriodActuals>(),
    getAccountActuals,
    inProgress: datePayload?.inProgress ?? false,
    periodNotStarted,
    isLoading: query.isLoading,
    wasDateClamped: false,
  };
}
