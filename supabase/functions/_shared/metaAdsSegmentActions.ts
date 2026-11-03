/**
 * Meta insight rows split by one segment (age, gender, region, placement, device, hour, day),
 * with the `actions` list kept so callers can count chats, leads, or link clicks per segment.
 *
 * The dashboard's demographic breakdown only keeps purchase metrics. This reader is separate
 * so the dashboard keeps its behavior; it is used by the MCP ads tools.
 */
import { demographicInsightScope, readDemographicIds } from "./metaAdsDemographicBreakdown.ts";

export const SEGMENT_DIMENSIONS = ["age", "gender", "region", "placement", "device", "hour", "day"] as const;
export type SegmentDimension = (typeof SEGMENT_DIMENSIONS)[number];

/** Meta breakdowns behind each segment. "day" has no breakdown; it reads one row per day. */
const BREAKDOWNS: Record<SegmentDimension, string | null> = {
  age: "age",
  gender: "gender",
  region: "region",
  placement: "publisher_platform,platform_position",
  device: "device_platform",
  hour: "hourly_stats_aggregated_by_advertiser_time_zone",
  day: null,
};

const FIELDS = "spend,impressions,inline_link_clicks,reach,actions,account_currency";
const MAX_PAGES = 10;

export type SegmentRowsResult = {
  currency: string | null;
  segments: Partial<Record<SegmentDimension, { rows: Record<string, unknown>[]; error: string | null }>>;
};

type GraphBody = {
  data?: Record<string, unknown>[];
  paging?: { cursors?: { after?: string } };
  error?: { message?: string };
};

function redactToken(message: string): string {
  return message.replace(/access_token=[^&\s"']+/gi, "access_token=redacted");
}

export function readSegmentDimensions(value: unknown): SegmentDimension[] {
  if (!Array.isArray(value) || value.length === 0) return [...SEGMENT_DIMENSIONS];
  const picked = value
    .map((item) => String(item ?? "").trim())
    .filter((item): item is SegmentDimension => (SEGMENT_DIMENSIONS as readonly string[]).includes(item));
  return picked.length > 0 ? [...new Set(picked)] : [...SEGMENT_DIMENSIONS];
}

async function fetchRows(args: {
  graphVersion: string;
  act: string;
  accessToken: string;
  level: string;
  filtering: string | null;
  breakdown: string | null;
  dateStart: string;
  dateEnd: string;
  daily: boolean;
}): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let after = "";
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      fields: FIELDS,
      level: args.level,
      use_unified_attribution_setting: "true",
      time_range: JSON.stringify({ since: args.dateStart, until: args.dateEnd }),
      limit: "500",
      access_token: args.accessToken,
    });
    if (args.breakdown) params.set("breakdowns", args.breakdown);
    if (args.daily) params.set("time_increment", "1");
    if (args.filtering) params.set("filtering", args.filtering);
    if (after) params.set("after", after);
    const res = await fetch(`https://graph.facebook.com/${args.graphVersion}/${args.act}/insights?${params.toString()}`);
    const json = (await res.json().catch(() => ({}))) as GraphBody;
    if (!res.ok) throw new Error(redactToken(json.error?.message ?? `HTTP ${res.status}`));
    rows.push(...(json.data ?? []));
    after = json.paging?.cursors?.after ?? "";
    if (!after) break;
  }
  return rows;
}

export async function loadMetaSegmentRows(args: {
  graphVersion: string;
  act: string;
  accessToken: string;
  dateStart: string;
  dateEnd: string;
  campaignIds: unknown;
  adsetIds: unknown;
  adIds: unknown;
  dimensions: unknown;
}): Promise<SegmentRowsResult> {
  const scope = demographicInsightScope({
    campaignIds: readDemographicIds(args.campaignIds),
    adsetIds: readDemographicIds(args.adsetIds),
    adIds: readDemographicIds(args.adIds),
  });
  const filtering = scope.field && scope.ids.length > 0
    ? JSON.stringify([{ field: scope.field, operator: "IN", value: scope.ids }])
    : null;
  const dimensions = readSegmentDimensions(args.dimensions);
  const outcomes = await Promise.all(dimensions.map(async (dimension) => {
    try {
      const rows = await fetchRows({
        graphVersion: args.graphVersion,
        act: args.act,
        accessToken: args.accessToken,
        level: scope.level,
        filtering,
        breakdown: BREAKDOWNS[dimension],
        dateStart: args.dateStart,
        dateEnd: args.dateEnd,
        daily: dimension === "day",
      });
      return [dimension, { rows, error: null }] as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to load ${dimension} breakdown`;
      return [dimension, { rows: [] as Record<string, unknown>[], error: redactToken(message).slice(0, 180) }] as const;
    }
  }));
  let currency: string | null = null;
  const segments: SegmentRowsResult["segments"] = {};
  for (const [dimension, outcome] of outcomes) {
    segments[dimension] = outcome;
    if (!currency) {
      const code = outcome.rows.map((row) => String(row.account_currency ?? "").trim()).find(Boolean);
      if (code) currency = code;
    }
  }
  return { currency, segments };
}
