import { type QueryClient, keepPreviousData, useQuery } from "@tanstack/react-query";
import { clampMetaAdsDateRange } from "@/meta-ads/lib/clampMetaAdsDateRange";
import { parseEdgeFunctionError } from "@/meta-ads/lib/parseEdgeFunctionError";
import {
  BREAKDOWN_RAW_METRIC_KEYS,
  breakdownDerivedMetrics,
  type BreakdownMetricKey,
  type BreakdownRawMetricKey,
} from "@/meta-ads/breakdown/metaAdsBreakdownMetrics";
import { supabase } from "@/shared/lib/supabaseClient";

export type MetaAdsDemographicBucket = {
  key: string;
} & Record<BreakdownMetricKey, number>;

export type MetaAdsDemographicBreakdown = {
  currency: string | null;
  age: MetaAdsDemographicBucket[];
  gender: MetaAdsDemographicBucket[];
  region: MetaAdsDemographicBucket[];
  regionReady: boolean;
  regionError: string | null;
  device: MetaAdsDemographicBucket[];
  publisher: MetaAdsDemographicBucket[];
  day: MetaAdsDemographicBucket[];
  hour: MetaAdsDemographicBucket[];
  deviceReady: boolean;
  publisherReady: boolean;
  dayReady: boolean;
  hourReady: boolean;
  deviceError: string | null;
  publisherError: string | null;
  dayError: string | null;
  hourError: string | null;
};

export const META_ADS_DEMOGRAPHIC_QUERY_ROOT = "meta-ads-demographic-breakdown";

function sortedIds(ids: string[]): string {
  return [...ids].sort().join(",");
}

export function buildMetaAdsDemographicQueryKey(args: {
  organizationId: string | null | undefined;
  adAccountId: string;
  dateStart: string;
  dateEnd: string;
  campaignIds: string[];
  adsetIds: string[];
  adIds: string[];
}): readonly unknown[] {
  const { start, end } = clampMetaAdsDateRange(args.dateStart, args.dateEnd);
  return [
    META_ADS_DEMOGRAPHIC_QUERY_ROOT,
    args.organizationId,
    args.adAccountId,
    start,
    end,
    sortedIds(args.campaignIds),
    sortedIds(args.adsetIds),
    sortedIds(args.adIds),
    "age-gender-region-placement-v5",
  ] as const;
}

function asBuckets(value: unknown): MetaAdsDemographicBucket[] {
  if (!Array.isArray(value)) return [];
  const buckets: MetaAdsDemographicBucket[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const key = String(record.key ?? "").trim();
    if (!key) continue;
    const bucket = { key } as MetaAdsDemographicBucket;
    const raw = {} as Record<BreakdownRawMetricKey, number>;
    for (const metric of BREAKDOWN_RAW_METRIC_KEYS) {
      const n = Number(record[metric]);
      raw[metric] = Number.isFinite(n) ? n : 0;
      bucket[metric] = raw[metric];
    }
    Object.assign(bucket, breakdownDerivedMetrics(raw));
    buckets.push(bucket);
  }
  return buckets;
}

export async function fetchMetaAdsDemographicBreakdown(args: {
  organizationId: string;
  adAccountId: string;
  dateStart: string;
  dateEnd: string;
  campaignIds: string[];
  adsetIds: string[];
  adIds: string[];
}): Promise<MetaAdsDemographicBreakdown> {
  const { start, end } = clampMetaAdsDateRange(args.dateStart, args.dateEnd);
  const { data, error } = await supabase.functions.invoke("meta-ads-metrics", {
    body: {
      action: "fetchDemographicBreakdown",
      organization_id: args.organizationId,
      ad_account_id: args.adAccountId,
      date_start: start,
      date_end: end,
      campaign_ids: args.campaignIds,
      adset_ids: args.adsetIds,
      ad_ids: args.adIds,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as {
    error?: string;
    currency?: unknown;
    age?: unknown;
    gender?: unknown;
    region?: unknown;
    region_error?: unknown;
    device?: unknown;
    publisher?: unknown;
    day?: unknown;
    hour?: unknown;
    device_error?: unknown;
    publisher_error?: unknown;
    day_error?: unknown;
    hour_error?: unknown;
  };
  const note = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  if (!Array.isArray(payload?.age) || !Array.isArray(payload?.gender)) {
    throw new Error("BREAKDOWN_UNAVAILABLE");
  }
  const currency = typeof payload?.currency === "string" && payload.currency.trim()
    ? payload.currency.trim()
    : null;
  const regionReady = Array.isArray(payload.region);
  const deviceReady = Array.isArray(payload.device);
  const publisherReady = Array.isArray(payload.publisher);
  const dayReady = Array.isArray(payload.day);
  const hourReady = Array.isArray(payload.hour);
  return {
    currency,
    age: asBuckets(payload.age),
    gender: asBuckets(payload.gender),
    region: regionReady ? asBuckets(payload.region) : [],
    regionReady,
    regionError: note(payload.region_error),
    device: deviceReady ? asBuckets(payload.device) : [],
    publisher: publisherReady ? asBuckets(payload.publisher) : [],
    day: dayReady ? asBuckets(payload.day) : [],
    hour: hourReady ? asBuckets(payload.hour) : [],
    deviceReady,
    publisherReady,
    dayReady,
    hourReady,
    deviceError: note(payload.device_error),
    publisherError: note(payload.publisher_error),
    dayError: note(payload.day_error),
    hourError: note(payload.hour_error),
  };
}

export async function refreshMetaAdsDemographicBreakdown(
  queryClient: QueryClient,
  args: {
    organizationId: string;
    adAccountId: string;
    dateStart: string;
    dateEnd: string;
    campaignIds: string[];
    adsetIds: string[];
    adIds: string[];
  },
): Promise<MetaAdsDemographicBreakdown> {
  const queryKey = buildMetaAdsDemographicQueryKey(args);
  return queryClient.fetchQuery({
    queryKey,
    queryFn: () => fetchMetaAdsDemographicBreakdown(args),
    staleTime: 0,
  });
}

export function useMetaAdsDemographicBreakdown(args: {
  organizationId: string | null | undefined;
  adAccountId: string;
  dateStart: string;
  dateEnd: string;
  campaignIds: string[];
  adsetIds: string[];
  adIds: string[];
  enabled?: boolean;
}) {
  const {
    organizationId,
    adAccountId,
    dateStart,
    dateEnd,
    campaignIds,
    adsetIds,
    adIds,
    enabled = true,
  } = args;

  return useQuery({
    queryKey: buildMetaAdsDemographicQueryKey({
      organizationId,
      adAccountId,
      dateStart,
      dateEnd,
      campaignIds,
      adsetIds,
      adIds,
    }),
    queryFn: async () => {
      if (!organizationId || !adAccountId) return null;
      return fetchMetaAdsDemographicBreakdown({
        organizationId,
        adAccountId,
        dateStart,
        dateEnd,
        campaignIds,
        adsetIds,
        adIds,
      });
    },
    enabled: Boolean(organizationId && adAccountId && enabled),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
