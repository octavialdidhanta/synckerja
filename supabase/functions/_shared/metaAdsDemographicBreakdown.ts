import { readCpasCounts } from "./metaAdsCpasMetrics.ts";

/** Age, gender, and region insight rows from the Meta Marketing API. */

export const DEMOGRAPHIC_METRIC_KEYS = [
  "impressions",
  "inline_link_clicks",
  "clicks",
  "unique_clicks",
  "outbound_clicks",
  "unique_outbound_clicks",
  "spend",
  "reach",
  "content_views",
  "adds_to_cart",
  "purchases",
  "atc_conversion_value",
  "purchase_conversion_value",
] as const;

export type DemographicMetricKey = (typeof DEMOGRAPHIC_METRIC_KEYS)[number];

export type DemographicBreakdownKind =
  | "age"
  | "gender"
  | "region"
  | "device_platform"
  | "publisher_platform"
  | "hourly_stats_aggregated_by_advertiser_time_zone";

export type DemographicBucket = {
  key: string;
} & Record<DemographicMetricKey, number>;

export type DemographicBreakdownPayload = {
  currency: string | null;
  age: DemographicBucket[];
  gender: DemographicBucket[];
  region: DemographicBucket[];
  region_error: string | null;
  device: DemographicBucket[];
  publisher: DemographicBucket[];
  day: DemographicBucket[];
  hour: DemographicBucket[];
  device_error: string | null;
  publisher_error: string | null;
  day_error: string | null;
  hour_error: string | null;
};

const DEVICE_ORDER = ["desktop", "mobile_app", "mobile_web"] as const;
const PUBLISHER_ORDER = ["audience_network", "facebook", "instagram", "messenger", "threads"] as const;
const WEEKDAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const HOUR_ORDER = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
const ALWAYS_VISIBLE_AGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
const GENDER_ORDER = ["female", "male", "unknown"] as const;
const MAX_FILTER_IDS = 50;
const MAX_PAGES = 15;

const CORE_FIELDS = "impressions,inline_link_clicks,clicks,spend,reach,account_currency";
const FULL_FIELDS = `${CORE_FIELDS},unique_clicks,outbound_clicks,unique_outbound_clicks`;
const SHARED_ITEM_FIELDS = "catalog_segment_actions,catalog_segment_value";
const ACTION_FIELDS = "actions,action_values";

const OMNI_PURCHASE_TYPES = ["omni_purchase", "purchase"] as const;
const PART_PURCHASE_TYPES = [
  "offsite_conversion.fb_pixel_purchase",
  "onsite_conversion.purchase",
  "onsite_web_purchase",
  "onsite_web_app_purchase",
  "app_custom_event.fb_mobile_purchase",
] as const;
const OMNI_VIEW_TYPES = ["omni_view_content", "view_content"] as const;
const PART_VIEW_TYPES = ["offsite_conversion.fb_pixel_view_content"] as const;
const OMNI_ATC_TYPES = ["omni_add_to_cart", "add_to_cart"] as const;
const PART_ATC_TYPES = ["offsite_conversion.fb_pixel_add_to_cart"] as const;

const SHARED_ITEM_KEYS = [
  "content_views",
  "adds_to_cart",
  "purchases",
  "atc_conversion_value",
  "purchase_conversion_value",
] as const;

type InsightScope = {
  level: "account" | "campaign" | "adset" | "ad";
  field: "campaign.id" | "adset.id" | "ad.id" | null;
  ids: string[];
};

type GraphBody = {
  data?: Record<string, unknown>[];
  paging?: { cursors?: { after?: string } };
  error?: { message?: string; code?: number };
};

class InsightRequestError extends Error {
  code: number | null;

  constructor(message: string, code: number | null) {
    super(message);
    this.name = "InsightRequestError";
    this.code = code;
  }
}

function emptyMetrics(): Record<DemographicMetricKey, number> {
  return {
    impressions: 0,
    inline_link_clicks: 0,
    clicks: 0,
    unique_clicks: 0,
    outbound_clicks: 0,
    unique_outbound_clicks: 0,
    spend: 0,
    reach: 0,
    content_views: 0,
    adds_to_cart: 0,
    purchases: 0,
    atc_conversion_value: 0,
    purchase_conversion_value: 0,
  };
}

function readCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => {
      if (item && typeof item === "object" && "value" in item) {
        return sum + readCount((item as { value: unknown }).value);
      }
      return sum;
    }, 0);
  }
  if (typeof value === "string" && value.trim() === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function hasAnyValue(metrics: Record<DemographicMetricKey, number> | undefined): boolean {
  if (!metrics) return false;
  return DEMOGRAPHIC_METRIC_KEYS.some((key) => metrics[key] !== 0);
}

function normalizeAge(raw: string): string | null {
  const key = raw.trim();
  if ((AGE_ORDER as readonly string[]).includes(key)) return key;
  if (key.toLowerCase() === "unknown") return "unknown";
  return null;
}

function normalizeGender(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (key === "female" || key === "male" || key === "unknown") return key;
  return null;
}

function normalizeRegion(raw: string): string | null {
  const key = raw.trim();
  if (!key) return null;
  if (key.toLowerCase() === "unknown") return "Unknown";
  return key;
}

function normalizeDevice(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (!key || key === "unknown") return null;
  return key;
}

function normalizePublisher(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (!key || key === "unknown") return null;
  return key;
}

function normalizeHour(raw: string): string | null {
  const match = /^(\d{1,2})/.exec(raw.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:00`;
}

function weekdayKey(raw: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return null;
  return WEEKDAY_ORDER[date.getUTCDay()] ?? null;
}

export function readDemographicIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    const id = String(item ?? "").trim();
    if (!/^\d+$/.test(id) || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= MAX_FILTER_IDS) break;
  }
  return ids;
}

/** Region breakdowns leave catalog_segment_actions empty. Copy the standard action lists into that shape. */
export function withSharedItemActions(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => ({
    ...row,
    catalog_segment_actions: row.actions,
    catalog_segment_value: row.action_values,
  }));
}

function sharedPurchaseTotal(rows: Record<string, unknown>[]): number {
  return rows.reduce((sum, row) => sum + readCpasCounts(row).purchases, 0);
}

function actionAmount(actions: unknown, type: string, asCount: boolean): number {
  if (!Array.isArray(actions)) return 0;
  const hit = actions.find(
    (item) => item && typeof item === "object" && String((item as { action_type?: string }).action_type ?? "") === type,
  ) as { value?: unknown } | undefined;
  if (!hit) return 0;
  const n = Number(String(hit.value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return asCount ? Math.round(n) : n;
}

/** Omni already includes the website and shop rows. Sum those rows only when Omni is absent. */
function countBreakdownAction(
  actions: unknown,
  omniTypes: readonly string[],
  partTypes: readonly string[],
  asCount: boolean,
): number {
  for (const type of omniTypes) {
    const amount = actionAmount(actions, type, asCount);
    if (amount > 0) return amount;
  }
  return partTypes.reduce((sum, type) => sum + actionAmount(actions, type, asCount), 0);
}

export function readBreakdownCommerce(row: Record<string, unknown>): {
  contentViews: number;
  addsToCart: number;
  purchases: number;
  atcConversionValue: number;
  purchaseConversionValue: number;
} {
  const shared = readCpasCounts(row);
  if (
    shared.purchases > 0 ||
    shared.purchaseConversionValue > 0 ||
    shared.contentViews > 0 ||
    shared.addsToCart > 0
  ) {
    return shared;
  }
  return {
    contentViews: countBreakdownAction(row.actions, OMNI_VIEW_TYPES, PART_VIEW_TYPES, true),
    addsToCart: countBreakdownAction(row.actions, OMNI_ATC_TYPES, PART_ATC_TYPES, true),
    purchases: countBreakdownAction(row.actions, OMNI_PURCHASE_TYPES, PART_PURCHASE_TYPES, true),
    atcConversionValue: countBreakdownAction(row.action_values, OMNI_ATC_TYPES, PART_ATC_TYPES, false),
    purchaseConversionValue: countBreakdownAction(row.action_values, OMNI_PURCHASE_TYPES, PART_PURCHASE_TYPES, false),
  };
}

/** Account-level region rows put every purchase in Unknown. Read purchases per campaign, then per ad. */
export function purchaseInsightScope(scope: InsightScope, level: "campaign" | "ad"): InsightScope {
  if (scope.level === "ad") return scope;
  if (level === "campaign" && scope.level !== "account") return scope;
  if (level === "campaign") return { level: "campaign", field: null, ids: [] };
  return { level: "ad", field: scope.field, ids: scope.ids };
}

export function sharedItemInsightScope(scope: InsightScope): InsightScope {
  return purchaseInsightScope(scope, "campaign");
}

export function withoutCommerceFields(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const next = { ...row };
    delete next.actions;
    delete next.action_values;
    delete next.catalog_segment_actions;
    delete next.catalog_segment_value;
    return next;
  });
}

export function hasNamedPurchases(rows: DemographicBucket[]): boolean {
  return rows.some((row) => row.purchases > 0 && row.key.toLowerCase() !== "unknown");
}

export function demographicInsightScope(args: {
  campaignIds: string[];
  adsetIds: string[];
  adIds: string[];
}): InsightScope {
  if (args.adIds.length > 0) return { level: "ad", field: "ad.id", ids: args.adIds };
  if (args.adsetIds.length > 0) return { level: "adset", field: "adset.id", ids: args.adsetIds };
  if (args.campaignIds.length > 0) {
    return { level: "campaign", field: "campaign.id", ids: args.campaignIds };
  }
  return { level: "account", field: null, ids: [] };
}

function breakdownBucketKey(breakdown: DemographicBreakdownKind, raw: string): string | null {
  if (breakdown === "age") return normalizeAge(raw);
  if (breakdown === "gender") return normalizeGender(raw);
  if (breakdown === "region") return normalizeRegion(raw);
  if (breakdown === "device_platform") return normalizeDevice(raw);
  if (breakdown === "publisher_platform") return normalizePublisher(raw);
  return normalizeHour(raw);
}

function addInsightRow(
  totals: Map<string, Record<DemographicMetricKey, number>>,
  key: string,
  row: Record<string, unknown>,
) {
  const current = totals.get(key) ?? emptyMetrics();
  const next = emptyMetrics();
  for (const metric of DEMOGRAPHIC_METRIC_KEYS) {
    if ((SHARED_ITEM_KEYS as readonly string[]).includes(metric)) continue;
    next[metric] = readCount(row[metric]);
  }
  const shared = readBreakdownCommerce(row);
  next.content_views = shared.contentViews;
  next.adds_to_cart = shared.addsToCart;
  next.purchases = shared.purchases;
  next.atc_conversion_value = shared.atcConversionValue;
  next.purchase_conversion_value = shared.purchaseConversionValue;
  for (const metric of DEMOGRAPHIC_METRIC_KEYS) current[metric] += next[metric];
  totals.set(key, current);
}

function bucketsFor(keys: readonly string[], totals: Map<string, Record<DemographicMetricKey, number>>): DemographicBucket[] {
  return keys.map((key) => ({
    key,
    ...(totals.get(key) ?? emptyMetrics()),
  }));
}

export function aggregateDemographicRows(
  breakdown: DemographicBreakdownKind,
  rows: Record<string, unknown>[],
): DemographicBucket[] {
  const totals = new Map<string, Record<DemographicMetricKey, number>>();
  for (const row of rows) {
    const key = breakdownBucketKey(breakdown, String(row[breakdown] ?? ""));
    if (!key) continue;
    addInsightRow(totals, key, row);
  }

  const keys =
    breakdown === "age"
      ? [
          ...(hasAnyValue(totals.get("13-17")) ? ["13-17"] : []),
          ...ALWAYS_VISIBLE_AGES,
          ...(hasAnyValue(totals.get("unknown")) ? ["unknown"] : []),
        ]
      : breakdown === "gender"
        ? [
            "female",
            "male",
            ...(hasAnyValue(totals.get("unknown")) ? ["unknown"] : []),
          ]
        : breakdown === "device_platform"
          ? [
              ...DEVICE_ORDER,
              ...[...totals.keys()].filter((key) => !(DEVICE_ORDER as readonly string[]).includes(key)).sort(),
            ]
          : breakdown === "publisher_platform"
            ? [
                ...PUBLISHER_ORDER.filter((key) => key === "audience_network" || key === "facebook" || key === "instagram" || hasAnyValue(totals.get(key))),
                ...[...totals.keys()].filter((key) => !(PUBLISHER_ORDER as readonly string[]).includes(key)).sort(),
              ]
            : breakdown === "hourly_stats_aggregated_by_advertiser_time_zone"
              ? HOUR_ORDER
        : [...totals.keys()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

  return bucketsFor(keys, totals);
}

/** Daily insight rows, summed into Sunday–Saturday in the account calendar. */
export function aggregateWeekdayRows(rows: Record<string, unknown>[]): DemographicBucket[] {
  const totals = new Map<string, Record<DemographicMetricKey, number>>();
  for (const row of rows) {
    const key = weekdayKey(String(row.date_start ?? ""));
    if (!key) continue;
    addInsightRow(totals, key, row);
  }
  return bucketsFor(WEEKDAY_ORDER, totals);
}

function readCurrency(rows: Record<string, unknown>[]): string | null {
  for (const row of rows) {
    const code = String(row.account_currency ?? "").trim();
    if (code) return code;
  }
  return null;
}

function redactToken(message: string): string {
  return message.replace(/access_token=[^&\s"']+/gi, "access_token=redacted");
}

function isInvalidFieldError(error: unknown): boolean {
  if (!(error instanceof InsightRequestError)) return false;
  return /fields param|is not valid|valid field|unknown field|nonexisting field/i.test(error.message);
}

function insightFiltering(scope: InsightScope, excludeInactive: boolean): string | null {
  const filters: Array<{ field: string; operator: string; value: string[] }> = [];
  if (scope.field && scope.ids.length > 0) {
    filters.push({ field: scope.field, operator: "IN", value: scope.ids });
  }
  if (excludeInactive && scope.level !== "account") {
    const field =
      scope.level === "ad"
        ? "ad.effective_status"
        : scope.level === "adset"
          ? "adset.effective_status"
          : "campaign.effective_status";
    filters.push({ field, operator: "NOT_IN", value: ["DELETED", "ARCHIVED"] });
  }
  return filters.length > 0 ? JSON.stringify(filters) : null;
}

async function fetchBreakdownPages(args: {
  graphVersion: string;
  act: string;
  accessToken: string;
  breakdown: string | null;
  scope: InsightScope;
  dateStart: string;
  dateEnd: string;
  fields: string;
  excludeInactive?: boolean;
  timeIncrement?: string;
}): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let after = "";
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      fields: args.fields,
      level: args.scope.level,
      use_unified_attribution_setting: "true",
      time_range: JSON.stringify({ since: args.dateStart, until: args.dateEnd }),
      limit: "500",
      access_token: args.accessToken,
    });
    if (args.breakdown) params.set("breakdowns", args.breakdown);
    if (args.timeIncrement) params.set("time_increment", args.timeIncrement);
    if (after) params.set("after", after);
    const filtering = insightFiltering(args.scope, args.excludeInactive === true);
    if (filtering) params.set("filtering", filtering);
    const url = `https://graph.facebook.com/${args.graphVersion}/${args.act}/insights?${params.toString()}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as GraphBody;
    if (!res.ok) {
      const message = redactToken(json.error?.message ?? `HTTP ${res.status}`);
      throw new InsightRequestError(message, json.error?.code ?? null);
    }
    rows.push(...(json.data ?? []));
    after = json.paging?.cursors?.after ?? "";
    if (!after) break;
  }
  return rows;
}

async function fetchBreakdownRows(
  args: Omit<Parameters<typeof fetchBreakdownPages>[0], "fields">,
): Promise<Record<string, unknown>[]> {
  try {
    return await fetchBreakdownPages({ ...args, fields: FULL_FIELDS });
  } catch (error) {
    if (!isInvalidFieldError(error)) throw error;
    return await fetchBreakdownPages({ ...args, fields: CORE_FIELDS });
  }
}

async function fetchBreakdownFields(
  args: Omit<Parameters<typeof fetchBreakdownPages>[0], "fields" | "excludeInactive">,
  fields: string,
): Promise<Record<string, unknown>[]> {
  try {
    return await fetchBreakdownPages({ ...args, fields, excludeInactive: true });
  } catch {
    try {
      return await fetchBreakdownPages({ ...args, fields, excludeInactive: false });
    } catch {
      return [];
    }
  }
}

async function fetchSharedItemRows(
  args: Omit<Parameters<typeof fetchBreakdownPages>[0], "fields" | "excludeInactive">,
  level: "campaign" | "ad",
): Promise<Record<string, unknown>[]> {
  const scoped = { ...args, scope: purchaseInsightScope(args.scope, level) };
  const catalogRows = await fetchBreakdownFields(scoped, SHARED_ITEM_FIELDS);
  if (sharedPurchaseTotal(catalogRows) > 0) {
    const named = aggregateDemographicRows(args.breakdown, catalogRows);
    if (hasNamedPurchases(named)) return catalogRows;
  }
  const actionRows = await fetchBreakdownFields(scoped, ACTION_FIELDS);
  return withSharedItemActions(actionRows);
}

export async function loadMetaDemographicBreakdown(args: {
  graphVersion: string;
  act: string;
  accessToken: string;
  dateStart: string;
  dateEnd: string;
  campaignIds: unknown;
  adsetIds: unknown;
  adIds: unknown;
}): Promise<DemographicBreakdownPayload> {
  const scope = demographicInsightScope({
    campaignIds: readDemographicIds(args.campaignIds),
    adsetIds: readDemographicIds(args.adsetIds),
    adIds: readDemographicIds(args.adIds),
  });
  const request = {
    graphVersion: args.graphVersion,
    act: args.act,
    accessToken: args.accessToken,
    scope,
    dateStart: args.dateStart,
    dateEnd: args.dateEnd,
  };
  const settle = (promise: Promise<Record<string, unknown>[]>, fallback: string) =>
    promise
      .then((rows) => ({ rows, error: null as string | null }))
      .catch((error: unknown) => ({
        rows: [] as Record<string, unknown>[],
        error: redactToken(error instanceof Error ? error.message : fallback),
      }));
  const [ageRows, genderRows, regionOutcome, ageShared, genderShared, deviceOutcome, publisherOutcome, dayOutcome, hourOutcome] =
    await Promise.all([
      fetchBreakdownRows({ ...request, breakdown: "age" }),
      fetchBreakdownRows({ ...request, breakdown: "gender" }),
      settle(fetchBreakdownRows({ ...request, breakdown: "region" }), "Failed to load region breakdown"),
      fetchSharedItemRows({ ...request, breakdown: "age" }, "campaign"),
      fetchSharedItemRows({ ...request, breakdown: "gender" }, "campaign"),
      settle(fetchBreakdownRows({ ...request, breakdown: "device_platform" }), "Failed to load device breakdown"),
      settle(fetchBreakdownRows({ ...request, breakdown: "publisher_platform" }), "Failed to load publisher breakdown"),
      settle(fetchDailyRows(request), "Failed to load day breakdown"),
      settle(
        fetchBreakdownRows({ ...request, breakdown: "hourly_stats_aggregated_by_advertiser_time_zone" }),
        "Failed to load hour breakdown",
      ),
    ]);
  return {
    currency:
      readCurrency(ageRows) ??
      readCurrency(genderRows) ??
      readCurrency(regionOutcome.rows) ??
      readCurrency(deviceOutcome.rows),
    age: aggregateDemographicRows("age", [...withoutCommerceFields(ageRows), ...ageShared]),
    gender: aggregateDemographicRows("gender", [...withoutCommerceFields(genderRows), ...genderShared]),
    region: aggregateDemographicRows("region", withoutCommerceFields(regionOutcome.rows)),
    region_error: regionOutcome.error,
    device: aggregateDemographicRows("device_platform", deviceOutcome.rows),
    publisher: aggregateDemographicRows("publisher_platform", publisherOutcome.rows),
    day: aggregateWeekdayRows(dayOutcome.rows),
    hour: aggregateDemographicRows("hourly_stats_aggregated_by_advertiser_time_zone", hourOutcome.rows),
    device_error: deviceOutcome.error,
    publisher_error: publisherOutcome.error,
    day_error: dayOutcome.error,
    hour_error: hourOutcome.error,
  };
}

async function fetchDailyRows(
  args: Omit<Parameters<typeof fetchBreakdownRows>[0], "breakdown">,
): Promise<Record<string, unknown>[]> {
  try {
    return await fetchBreakdownPages({ ...args, breakdown: null, fields: FULL_FIELDS, timeIncrement: "1" });
  } catch (error) {
    if (!isInvalidFieldError(error)) throw error;
    return await fetchBreakdownPages({ ...args, breakdown: null, fields: CORE_FIELDS, timeIncrement: "1" });
  }
}
