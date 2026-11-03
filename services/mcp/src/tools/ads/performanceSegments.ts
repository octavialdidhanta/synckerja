import type { McpAuthContext } from "../../authz/context";
import { calendarDay, monthPattern } from "../inputs";
import { resolveAdsPerformancePeriod } from "./performanceSummary";
import { z } from "zod";

const metaId = z.string().trim().regex(/^(act_)?\d{1,30}$/);

export const SEGMENT_DIMENSIONS = ["age", "gender", "region", "placement", "device", "hour", "day"] as const;
export type SegmentDimension = (typeof SEGMENT_DIMENSIONS)[number];

export const adsSegmentsInput = z
  .object({
    dimensions: z.array(z.enum(SEGMENT_DIMENSIONS)).min(1).max(SEGMENT_DIMENSIONS.length).optional(),
    month: z.string().regex(monthPattern).optional(),
    date_start: calendarDay.optional(),
    date_end: calendarDay.optional(),
    account_id: metaId.optional(),
    campaign_id: metaId.optional(),
    adset_id: metaId.optional(),
    ad_id: metaId.optional(),
  })
  .strict();

export type AdsSegmentsQuery = {
  dimensions: SegmentDimension[];
  month: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  accountId: string | null;
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
};

export type SegmentSourceBucket = {
  key: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number | null;
  results: number | null;
  results_label: string | null;
};

export type AdsSegmentsSourceAccount = {
  platform: string;
  label: string | null;
  account_id: string;
  currency: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  segments?: Partial<Record<SegmentDimension, { buckets: SegmentSourceBucket[]; error: string | null }>>;
  segment_results_label?: string | null;
  error: string | null;
  note: string | null;
};

export type AdsSegmentsSource = {
  period: { start: string; end: string; clipped: boolean };
  truncated: boolean;
  accounts: AdsSegmentsSourceAccount[];
};

export type SegmentBucket = SegmentSourceBucket & {
  label: string;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cost_per_result: number | null;
  share_of_spend: number | null;
  share_of_results: number | null;
};

export type SegmentView = {
  buckets: SegmentBucket[];
  total_spend: number;
  total_results: number | null;
  best: { lowest_cost_per_result: string | null; most_results: string | null; lowest_cpm: string | null };
  error: string | null;
};

export type AdsSegmentsAccount = {
  label: string | null;
  account_id: string;
  status: "ok" | "unavailable";
  currency: string | null;
  account_spend: number | null;
  results_label: string | null;
  segments: Partial<Record<SegmentDimension, SegmentView>>;
  note: string | null;
  error: string | null;
};

export type AdsSegments = {
  period: { start: string; end: string; clipped: boolean };
  how_to_read: string;
  accounts: AdsSegmentsAccount[];
  readings: string[];
  notes: string[];
};

const HOW_TO_READ =
  "Meta delivery for the period split by segment: age, gender, region (province), placement (platform / position, for example instagram / instagram_reels), device, hour (account time zone), and day. Each dimension splits the same delivery on its own, so add buckets only within one dimension. Results follow the campaign objective and ad set goal like Results in Ads Manager, and results_label names them; when campaigns in scope count different results, results are empty and campaign_id narrows it. Clicks are link clicks and CTR is a percentage. best names the bucket key that leads each metric; cost per result needs at least one result and 5% of the dimension's spend. Meta does not report delivery by city, district, or radius, so a local business mostly shows one region; use hour, day, age, and placement to steer local ads, and ads.audience.list for the radius. Small result counts are noisy; say so before calling a winner.";

const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+", "unknown"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MIN_SPEND_SHARE = 0.05;

function stripAct(value: string): string {
  return value.replace(/^act_/, "");
}

export function parseAdsSegmentsQuery(args: unknown): AdsSegmentsQuery | null {
  const parsed = adsSegmentsInput.safeParse(args ?? {});
  if (!parsed.success) return null;
  const month = parsed.data.month ?? null;
  const dateStart = parsed.data.date_start ?? null;
  const dateEnd = parsed.data.date_end ?? null;
  if (month && (dateStart || dateEnd)) return null;
  if ((dateStart == null) !== (dateEnd == null)) return null;
  if (dateStart && dateEnd && dateStart > dateEnd) return null;
  const scoped = [parsed.data.campaign_id, parsed.data.adset_id, parsed.data.ad_id].filter(Boolean);
  if (scoped.length > 1) return null;
  return {
    dimensions: parsed.data.dimensions ? [...new Set(parsed.data.dimensions)] : [...SEGMENT_DIMENSIONS],
    month,
    dateStart,
    dateEnd,
    accountId: parsed.data.account_id ? stripAct(parsed.data.account_id) : null,
    campaignId: parsed.data.campaign_id ? stripAct(parsed.data.campaign_id) : null,
    adsetId: parsed.data.adset_id ? stripAct(parsed.data.adset_id) : null,
    adId: parsed.data.ad_id ? stripAct(parsed.data.ad_id) : null,
  };
}

export function resolveAdsSegmentsPeriod(query: AdsSegmentsQuery, now = new Date()) {
  return resolveAdsPerformancePeriod({ month: query.month, dateStart: query.dateStart, dateEnd: query.dateEnd, platform: "meta" }, now);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function bucketLabel(dimension: SegmentDimension, key: string): string {
  if (dimension === "day") {
    const date = new Date(`${key}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? key : `${WEEKDAYS[date.getUTCDay()]} ${key}`;
  }
  if (dimension === "hour") return `${key}–${String((Number(key.slice(0, 2)) + 1) % 24).padStart(2, "0")}:00`;
  return key;
}

function orderBuckets(dimension: SegmentDimension, buckets: SegmentBucket[]): SegmentBucket[] {
  const sorted = [...buckets];
  if (dimension === "age") {
    return sorted.sort((a, b) => (AGE_ORDER.indexOf(a.key) + 99) % 99 - (AGE_ORDER.indexOf(b.key) + 99) % 99);
  }
  if (dimension === "hour" || dimension === "day") return sorted.sort((a, b) => a.key.localeCompare(b.key));
  return sorted.sort((a, b) => b.spend - a.spend || b.impressions - a.impressions);
}

function bestKey(
  buckets: SegmentBucket[],
  value: (bucket: SegmentBucket) => number | null,
  direction: "higher" | "lower",
): string | null {
  const scored = buckets
    .map((bucket) => ({ bucket, score: value(bucket) }))
    .filter((item): item is { bucket: SegmentBucket; score: number } => item.score != null);
  if (scored.length < 2) return null;
  scored.sort((a, b) => (direction === "higher" ? b.score - a.score : a.score - b.score));
  if (scored[0].score === scored[1].score) return null;
  return scored[0].bucket.key;
}

function deriveView(
  dimension: SegmentDimension,
  block: { buckets: SegmentSourceBucket[]; error: string | null },
): SegmentView {
  const totalSpend = block.buckets.reduce((sum, bucket) => sum + bucket.spend, 0);
  const hasResults = block.buckets.some((bucket) => bucket.results != null);
  const totalResults = hasResults ? block.buckets.reduce((sum, bucket) => sum + (bucket.results ?? 0), 0) : null;
  const buckets = orderBuckets(dimension, block.buckets
    .filter((bucket) => bucket.spend > 0 || bucket.impressions > 0)
    .map((bucket) => {
      const spend = round(bucket.spend, 2);
      return {
        ...bucket,
        spend,
        label: bucketLabel(dimension, bucket.key),
        ctr: bucket.impressions > 0 ? round((bucket.clicks / bucket.impressions) * 100, 2) : null,
        cpc: bucket.clicks > 0 ? round(spend / bucket.clicks, 2) : null,
        cpm: bucket.impressions > 0 ? round((spend / bucket.impressions) * 1000, 2) : null,
        cost_per_result: bucket.results != null && bucket.results > 0 ? round(spend / bucket.results, 2) : null,
        share_of_spend: totalSpend > 0 ? round((spend / totalSpend) * 100, 1) : null,
        share_of_results: totalResults && bucket.results != null ? round((bucket.results / totalResults) * 100, 1) : null,
      };
    }));
  const meaningful = buckets.filter((bucket) => totalSpend <= 0 || bucket.spend / totalSpend >= MIN_SPEND_SHARE);
  return {
    buckets,
    total_spend: round(totalSpend, 2),
    total_results: totalResults,
    best: {
      lowest_cost_per_result: bestKey(meaningful, (bucket) => bucket.cost_per_result, "lower"),
      most_results: bestKey(buckets, (bucket) => (bucket.results && bucket.results > 0 ? bucket.results : null), "higher"),
      lowest_cpm: bestKey(meaningful.filter((bucket) => bucket.impressions >= 300), (bucket) => bucket.cpm, "lower"),
    },
    error: block.error,
  };
}

const DIMENSION_NOUN: Record<SegmentDimension, string> = {
  age: "age group",
  gender: "gender",
  region: "region",
  placement: "placement",
  device: "device",
  hour: "hour",
  day: "day",
};

export function presentAdsSegments(source: AdsSegmentsSource, dimensions: SegmentDimension[]): AdsSegments {
  const accounts: AdsSegmentsAccount[] = source.accounts
    .filter((row) => row.platform === "meta")
    .map((row) => {
      const segments: Partial<Record<SegmentDimension, SegmentView>> = {};
      if (!row.error) {
        for (const dimension of dimensions) {
          const block = row.segments?.[dimension];
          if (block) segments[dimension] = deriveView(dimension, block);
        }
      }
      return {
        label: row.label,
        account_id: row.account_id,
        status: row.error ? "unavailable" as const : "ok" as const,
        currency: row.error ? null : row.currency,
        account_spend: row.error ? null : row.spend,
        results_label: row.segment_results_label ?? null,
        segments,
        note: row.note,
        error: row.error,
      };
    });

  const readings: string[] = [];
  for (const account of accounts) {
    if (account.status !== "ok") continue;
    const who = account.label ?? account.account_id;
    const noun = account.results_label ?? "result";
    for (const dimension of dimensions) {
      const view = account.segments[dimension];
      if (!view) continue;
      if (view.error) {
        readings.push(`${who}: ${DIMENSION_NOUN[dimension]} split could not be loaded.`);
        continue;
      }
      if (view.buckets.length === 0) continue;
      const cheapest = view.buckets.find((bucket) => bucket.key === view.best.lowest_cost_per_result);
      if (cheapest) {
        readings.push(
          `${who}: by ${DIMENSION_NOUN[dimension]}, ${cheapest.label} has the lowest cost per ${noun} at ${cheapest.cost_per_result} ${account.currency ?? ""}`.trimEnd()
            + ` (${cheapest.results} results, ${cheapest.share_of_spend ?? 0}% of spend).`,
        );
      } else if (view.buckets.length === 1) {
        readings.push(`${who}: all delivery is in one ${DIMENSION_NOUN[dimension]} (${view.buckets[0].label}).`);
      }
    }
  }

  const notes: string[] = [];
  if (source.period.clipped) notes.push("The requested range was longer than 366 days, so it was cut to the latest 366 days.");
  for (const account of accounts) {
    if (account.note) notes.push(`${account.label ?? account.account_id}: ${account.note}`);
  }
  if (accounts.length === 0) notes.push("No active Meta ad account is connected, or none matches account_id.");
  else if (accounts.every((row) => row.status === "unavailable")) notes.push("Meta segment performance could not be loaded.");

  return { period: source.period, how_to_read: HOW_TO_READ, accounts, readings, notes };
}

export function adsSegmentsResult(
  ctx: McpAuthContext,
  query: AdsSegmentsQuery,
  list: (ctx: McpAuthContext, query: AdsSegmentsQuery) => Promise<AdsSegments>,
): Promise<AdsSegments> {
  return list(ctx, query);
}
