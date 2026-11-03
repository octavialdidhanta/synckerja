/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  credentialShape,
  describeOrganizationMembership,
  internalSecretMatches,
} from "../_shared/scheduledPosts/scheduledPostsInternalAuth.ts";
import { metaAccountResult, metaCampaignResult } from "./metaResults.ts";
import { breakdownRow, breakdownRows, campaignGoals, type BreakdownLevel, type BreakdownRow } from "./metaBreakdown.ts";
import { scopeGoal, segmentBuckets, type SegmentBucket } from "./metaSegments.ts";
import { summarizeAudience, type AudienceSummary } from "./metaAudience.ts";

const MAX_AUDIENCE_ADSETS = 10;
const SEGMENT_DIMENSIONS = ["age", "gender", "region", "placement", "device", "hour", "day"] as const;
type SegmentDimension = (typeof SEGMENT_DIMENSIONS)[number];
type Mode = "performance" | "audience" | "segments";

type AudienceRow = {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  delivery: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  results_label: string;
  audience: AudienceSummary | null;
  error: string | null;
};

type SegmentBlock = { buckets: SegmentBucket[]; error: string | null };

const MAX_ACCOUNTS = 12;
const MAX_CAMPAIGNS = 25;
const MAX_META_PAGES = 4;
const MAX_INCLUSIVE_DAYS = 366;

type Platform = "google" | "meta" | "tiktok";

type AccountRef = {
  platform: Platform;
  label: string | null;
  accountId: string;
  rowId: string | null;
};

type CampaignRow = {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number | null;
  results: number | null;
  results_label: string | null;
  result_value: number | null;
};

type PerformanceRow = {
  platform: Platform;
  label: string | null;
  account_id: string;
  currency: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  results: number | null;
  results_label: string | null;
  result_value: number | null;
  campaigns: CampaignRow[];
  campaigns_truncated: boolean;
  /** Ad set or ad rows, only when the request asks for that level. */
  rows?: BreakdownRow[];
  rows_truncated?: boolean;
  /** Ad set targeting, only in audience mode. */
  audiences?: AudienceRow[];
  audiences_truncated?: boolean;
  /** Segment buckets, only in segments mode. */
  segments?: Partial<Record<SegmentDimension, SegmentBlock>>;
  segment_results_label?: string | null;
  error: string | null;
  note: string | null;
};

type ReadContext = {
  userId: string;
  organizationId: string;
  secret: string;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function publicError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "request_failed";
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || /token|secret|bearer|authorization/i.test(text)) return "request_failed";
  return text.slice(0, 180);
}

function failRow(
  account: AccountRef,
  message: string,
  resultsLabel: string,
): PerformanceRow {
  return {
    platform: account.platform,
    label: account.label,
    account_id: account.accountId,
    currency: null,
    spend: null,
    impressions: null,
    clicks: null,
    reach: null,
    results: null,
    results_label: resultsLabel,
    result_value: null,
    campaigns: [],
    campaigns_truncated: false,
    error: message,
    note: null,
  };
}

function reject(reason: string, error: string, status: number, extra: Record<string, unknown> = {}): Response {
  console.error("mcp-ads-performance: rejected", { reason, ...extra });
  return json({ error }, status);
}

/** Secret match is the door. The service-role string is logged, not required. */
function internalDoor(req: Request, body: Record<string, unknown>): Response | null {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const secret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  const provided = typeof body.internal_secret === "string" ? body.internal_secret : "";
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const apiKey = (req.headers.get("apikey") ?? "").trim();
  if (!secret) {
    return reject("secret_missing", "misconfigured", 500);
  }
  if (!internalSecretMatches(provided, secret)) {
    return reject("secret_rejected", "forbidden: internal credential rejected", 403, {
      bearerShape: credentialShape(token),
      apiKeyShape: credentialShape(apiKey),
      envKeyShape: credentialShape(serviceRoleKey),
    });
  }
  if (serviceRoleKey && token !== serviceRoleKey && apiKey !== serviceRoleKey) {
    console.warn("mcp-ads-performance: internal secret accepted with a different service credential", {
      bearerShape: credentialShape(token),
      apiKeyShape: credentialShape(apiKey),
      envKeyShape: credentialShape(serviceRoleKey),
    });
  }
  return null;
}

function parseYmd(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return text;
}

function shiftYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function inclusiveDays(start: string, end: string): number {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000) + 1;
}

function labelOf(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function pickAccounts(groups: AccountRef[][]): { selected: AccountRef[]; truncated: boolean } {
  const queues = groups.map((group) => [...group]);
  const total = queues.reduce((sum, queue) => sum + queue.length, 0);
  const selected: AccountRef[] = [];
  while (selected.length < MAX_ACCOUNTS && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      if (selected.length >= MAX_ACCOUNTS) break;
      const next = queue.shift();
      if (next) selected.push(next);
    }
  }
  return { selected, truncated: total > selected.length };
}

async function loadAccounts(
  admin: SupabaseClient,
  organizationId: string,
  platform: Platform | null,
): Promise<{ accounts: AccountRef[]; truncated: boolean }> {
  const load = async (
    table: string,
    idColumn: string,
    kind: Platform,
  ): Promise<AccountRef[]> => {
    if (platform && platform !== kind) return [];
    const { data, error } = await admin
      .from(table)
      .select(`id, label, ${idColumn}`)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("label", { ascending: true })
      .limit(MAX_ACCOUNTS + 1);
    if (error) throw new Error(error.message);
    return (data ?? []).flatMap((row) => {
      const record = row as Record<string, unknown>;
      const accountId = String(record[idColumn] ?? "").trim();
      if (!accountId) return [];
      return [{
        platform: kind,
        label: labelOf(record.label),
        accountId,
        rowId: record.id != null ? String(record.id) : null,
      }];
    });
  };

  const [google, meta, tiktok] = await Promise.all([
    load("organization_google_ads_accounts", "customer_id", "google"),
    load("organization_meta_ads_accounts", "ad_account_id", "meta"),
    load("organization_tiktok_ads_accounts", "advertiser_id", "tiktok"),
  ]);
  const picked = pickAccounts([google, meta, tiktok]);
  const truncated = picked.truncated
    || google.length > MAX_ACCOUNTS
    || meta.length > MAX_ACCOUNTS
    || tiktok.length > MAX_ACCOUNTS;
  return { accounts: picked.selected, truncated };
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function positiveOrNull(value: unknown): number | null {
  const number = asNumber(value);
  return number > 0 ? number : null;
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    : [];
}

class MetricsCallError extends Error {
  code: string;
  constructor(message: string, code = "") {
    super(message);
    this.code = code;
  }
}

function performanceErrorMessage(error: unknown, reconnect: string): string {
  const raw = error instanceof Error ? error.message : "";
  if (raw.startsWith("upstream_error:")) return raw.slice(0, 180);
  const code = error instanceof MetricsCallError ? error.code : "";
  if (
    code === "TOKEN_REFRESH_FAILED"
    || /invalid_grant/i.test(raw)
    || (/token|oauth|session/i.test(raw) && /invalid|expired|revoked/i.test(raw))
  ) {
    return reconnect;
  }
  return publicError(error);
}

function platformOf(functionName: string): string {
  if (functionName.startsWith("meta")) return "meta";
  if (functionName.startsWith("google")) return "google";
  if (functionName.startsWith("tiktok")) return "tiktok";
  return "ads";
}

async function postDashboard(
  functionName: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof payload.error === "string") {
    const message = typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`;
    const code = typeof payload.code === "string" ? payload.code : "";
    if (response.status === 401 || response.status === 403) {
      const platform = platformOf(functionName);
      console.error("mcp-ads-performance: upstream rejected", {
        platform,
        status: response.status,
        error: publicError(message),
      });
      throw new MetricsCallError(
        `upstream_error: ${platform} ${response.status} ${publicError(message)}`.slice(0, 180),
        code || String(response.status),
      );
    }
    throw new MetricsCallError(message, code);
  }
  return payload;
}

function dashboardBody(ctx: ReadContext, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    organization_id: ctx.organizationId,
    mcp_user_id: ctx.userId,
    internal_secret: ctx.secret,
    ...extra,
  };
}

function topCampaigns(
  campaigns: CampaignRow[],
  moreRemain: boolean,
): { campaigns: CampaignRow[]; campaigns_truncated: boolean } {
  const sorted = [...campaigns].sort((left, right) => right.spend - left.spend || right.impressions - left.impressions);
  return {
    campaigns: sorted.slice(0, MAX_CAMPAIGNS),
    campaigns_truncated: moreRemain || sorted.length > MAX_CAMPAIGNS,
  };
}

function campaignName(value: unknown): string {
  const text = String(value ?? "").trim();
  return text || "Campaign";
}

async function googlePerformance(
  ctx: ReadContext,
  account: AccountRef,
  start: string,
  end: string,
): Promise<PerformanceRow> {
  try {
    const payload = await postDashboard("google-ads-metrics", dashboardBody(ctx, {
      action: "fetchMetrics",
      customer_id: account.accountId,
      entity: "campaign",
      metrics: [
        "impressions",
        "clicks",
        "ctr",
        "spent",
        "conversions",
        "conv_rate",
        "avg_cpc",
        "cost_per_conv",
        "conv_value",
      ],
      date_range: { start, end },
      only_running: true,
      status_filter: "all",
      page_size: 100,
      sort: { field: "spent", direction: "desc" },
    }));
    const totals = recordOf(payload.summary_totals);
    const byKey = recordOf(totals.by_key);
    const rows = rowsOf(payload.rows);
    const listed = rows.map((raw) => {
      const identity = recordOf(raw.identity);
      const metrics = recordOf(raw.metrics);
      return {
        id: String(identity.campaign_id ?? raw.id ?? ""),
        name: campaignName(identity.name),
        spend: asNumber(metrics.spent),
        impressions: asNumber(metrics.impressions),
        clicks: asNumber(metrics.clicks),
        reach: null,
        results: asNumber(metrics.conversions),
        results_label: "conversions" as const,
        result_value: positiveOrNull(metrics.conv_value),
      };
    });
    const totalRows = asNumber(payload.total_row_count);
    const picked = topCampaigns(listed, totalRows > listed.length);
    const notes = ["Campaign tab with Delivery on and Enabled off. Account totals are the full summary bar."];
    if (payload.manager_aggregate === true) {
      notes.push("Manager totals follow the dashboard.");
    }
    if (picked.campaigns_truncated) {
      notes.push("Campaign list keeps the highest spend campaigns. The account total includes the rest.");
    }
    return {
      platform: "google",
      label: account.label,
      account_id: account.accountId,
      currency: typeof payload.currency_code === "string" && payload.currency_code.trim()
        ? payload.currency_code
        : null,
      spend: asNumber(totals.spent),
      impressions: asNumber(totals.impressions),
      clicks: asNumber(totals.clicks),
      reach: null,
      results: asNumber(totals.conversions),
      results_label: "conversions",
      result_value: positiveOrNull(byKey.conv_value),
      campaigns: picked.campaigns,
      campaigns_truncated: picked.campaigns_truncated,
      error: null,
      note: notes.join(" "),
    };
  } catch (error) {
    return failRow(account, performanceErrorMessage(error, "Google Ads authorization expired. Reconnect the account."), "conversions");
  }
}

/** Dashboard rows for one Meta tab (campaign, ad set, or ad), up to MAX_META_PAGES pages. */
async function metaEntityRows(
  ctx: ReadContext,
  account: AccountRef,
  entity: "campaign" | BreakdownLevel,
  start: string,
  end: string,
): Promise<{ summary: Record<string, unknown>; rows: Record<string, unknown>[]; moreRemain: boolean }> {
  const rows: Record<string, unknown>[] = [];
  let summary: Record<string, unknown> | null = null;
  let pageToken = "";
  let moreRemain = false;
  for (let page = 0; page < MAX_META_PAGES; page += 1) {
    const payload = await postDashboard("meta-ads-metrics", dashboardBody(ctx, {
      entity,
      ad_account_id: account.accountId,
      date_start: start,
      date_end: end,
      page_token: pageToken,
    }));
    if (!summary) summary = recordOf(payload.summary);
    rows.push(...rowsOf(payload.rows));
    const next = typeof payload.next_page_token === "string" ? payload.next_page_token.trim() : "";
    if (!next) {
      moreRemain = false;
      break;
    }
    if (page === MAX_META_PAGES - 1) {
      moreRemain = true;
      break;
    }
    pageToken = next;
  }
  return { summary: summary ?? {}, rows, moreRemain };
}

async function metaBreakdown(
  ctx: ReadContext,
  account: AccountRef,
  level: BreakdownLevel,
  start: string,
  end: string,
  campaignId: string | null,
): Promise<PerformanceRow> {
  try {
    // Campaign rows carry the objective and ad set goals that decide Results for each row below.
    const [entity, campaigns] = await Promise.all([
      metaEntityRows(ctx, account, level, start, end),
      metaEntityRows(ctx, account, "campaign", start, end),
    ]);
    const picked = breakdownRows(level, entity.rows, campaigns.rows, campaignId);
    const tab = level === "ad" ? "Ads tab" : "Ad sets tab";
    const notes = [
      `${tab}. Account totals are the summary bar. Rows are the highest-spend ${level === "ad" ? "ads" : "ad sets"}.`,
      "Results follow the campaign objective and ad set goal, like Results in Ads Manager.",
    ];
    if (campaignId) notes.push("Rows are limited to the requested campaign.");
    const truncated = picked.truncated || entity.moreRemain;
    if (truncated) notes.push("More rows exist than are listed. The account total includes them.");
    const totals = entity.summary;
    return {
      platform: "meta",
      label: account.label,
      account_id: account.accountId,
      currency: typeof totals.currency === "string" && totals.currency.trim() ? totals.currency : null,
      spend: asNumber(totals.spend),
      impressions: asNumber(totals.impressions),
      clicks: asNumber(totals.clicks),
      reach: asNumber(totals.reach),
      results: null,
      results_label: null,
      result_value: null,
      campaigns: [],
      campaigns_truncated: false,
      rows: picked.rows,
      rows_truncated: truncated,
      error: null,
      note: notes.join(" "),
    };
  } catch (error) {
    return failRow(account, performanceErrorMessage(error, "Meta Ads authorization expired. Reconnect the account."), "purchases");
  }
}

type MetaFilters = {
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
};

function accountShell(account: AccountRef, totals: Record<string, unknown>, note: string): PerformanceRow {
  return {
    platform: "meta",
    label: account.label,
    account_id: account.accountId,
    currency: typeof totals.currency === "string" && totals.currency.trim() ? totals.currency : null,
    spend: asNumber(totals.spend),
    impressions: asNumber(totals.impressions),
    clicks: asNumber(totals.clicks),
    reach: asNumber(totals.reach),
    results: null,
    results_label: null,
    result_value: null,
    campaigns: [],
    campaigns_truncated: false,
    error: null,
    note,
  };
}

/** Targeting of the ad sets that delivered in the period, highest spend first. */
async function metaAudience(
  ctx: ReadContext,
  account: AccountRef,
  start: string,
  end: string,
  filters: MetaFilters,
): Promise<PerformanceRow> {
  try {
    const [adsets, campaigns] = await Promise.all([
      metaEntityRows(ctx, account, "adset", start, end),
      metaEntityRows(ctx, account, "campaign", start, end),
    ]);
    const goals = campaignGoals(campaigns.rows);
    // Only ad sets this account reported for the period are read, so an id from elsewhere is never looked up.
    const listed = adsets.rows
      .filter((raw) => !filters.campaignId || String(raw.campaign_id ?? "").trim() === filters.campaignId)
      .filter((raw) => !filters.adsetId || String(raw.adset_id ?? "").trim() === filters.adsetId)
      .map((raw) => breakdownRow("adset", raw, goals))
      .filter((row) => row.id && (row.spend > 0 || row.impressions > 0))
      .sort((left, right) => right.spend - left.spend);
    const picked = listed.slice(0, MAX_AUDIENCE_ADSETS);
    const audiences = await Promise.all(picked.map(async (row): Promise<AudienceRow> => {
      const base = {
        adset_id: row.id,
        adset_name: row.name,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        delivery: row.delivery,
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        results: row.results,
        results_label: row.results_label,
      };
      try {
        const payload = await postDashboard("meta-ads-metrics", dashboardBody(ctx, {
          action: "fetchAdsetAudience",
          ad_account_id: account.accountId,
          adset_id: row.id,
        }));
        return { ...base, audience: summarizeAudience(payload.targeting, payload.sentence_lines), error: null };
      } catch (error) {
        return { ...base, audience: null, error: performanceErrorMessage(error, "Meta Ads authorization expired. Reconnect the account.") };
      }
    }));
    const notes = ["Ad set targeting for ad sets with delivery in the period, highest spend first."];
    if (filters.adsetId && audiences.length === 0) {
      notes.push("The requested ad set had no delivery in this period, so its targeting was not read.");
    }
    if (listed.length > picked.length) notes.push(`Only the top ${MAX_AUDIENCE_ADSETS} ad sets by spend are included.`);
    return {
      ...accountShell(account, adsets.summary, notes.join(" ")),
      audiences,
      audiences_truncated: listed.length > picked.length,
    };
  } catch (error) {
    return failRow(account, performanceErrorMessage(error, "Meta Ads authorization expired. Reconnect the account."), "purchases");
  }
}

/** Spend, delivery, and results split by age, gender, region, placement, device, hour, and day. */
async function metaSegments(
  ctx: ReadContext,
  account: AccountRef,
  start: string,
  end: string,
  filters: MetaFilters,
  dimensions: SegmentDimension[],
): Promise<PerformanceRow> {
  try {
    const level: BreakdownLevel | null = filters.adId ? "ad" : filters.adsetId ? "adset" : null;
    const [campaigns, entity] = await Promise.all([
      metaEntityRows(ctx, account, "campaign", start, end),
      level ? metaEntityRows(ctx, account, level, start, end) : Promise.resolve(null),
    ]);
    // The campaigns in scope decide which action counts as a result in every segment.
    let campaignIds: Set<string> | null = filters.campaignId ? new Set([filters.campaignId]) : null;
    if (level && entity) {
      const key = level === "ad" ? "ad_id" : "adset_id";
      const wanted = level === "ad" ? filters.adId : filters.adsetId;
      campaignIds = new Set(
        entity.rows
          .filter((raw) => String(raw[key] ?? "").trim() === wanted)
          .map((raw) => String(raw.campaign_id ?? "").trim())
          .filter(Boolean),
      );
    }
    const scope = scopeGoal(campaigns.rows, campaignIds);
    const payload = await postDashboard("meta-ads-metrics", dashboardBody(ctx, {
      action: "fetchSegmentActions",
      ad_account_id: account.accountId,
      date_start: start,
      date_end: end,
      campaign_ids: filters.campaignId && !level ? [filters.campaignId] : [],
      adset_ids: filters.adsetId && level === "adset" ? [filters.adsetId] : [],
      ad_ids: filters.adId ? [filters.adId] : [],
      dimensions,
    }));
    const raw = recordOf(payload.segments);
    const segments: Partial<Record<SegmentDimension, SegmentBlock>> = {};
    for (const dimension of dimensions) {
      const block = recordOf(raw[dimension]);
      segments[dimension] = {
        buckets: segmentBuckets(dimension, rowsOf(block.rows), scope.goal),
        error: typeof block.error === "string" && block.error ? publicError(new Error(block.error)) : null,
      };
    }
    const notes = [
      "Account spend, impressions, clicks, and reach are the whole account. Segment buckets cover only the requested scope; each dimension splits that same delivery on its own.",
    ];
    if (filters.adId) notes.push("Limited to the requested ad.");
    else if (filters.adsetId) notes.push("Limited to the requested ad set.");
    else if (filters.campaignId) notes.push("Limited to the requested campaign.");
    if (scope.mixed) notes.push("Campaigns in scope count different results, so segment results are empty. Pass campaign_id to read one campaign.");
    notes.push("Region is the province Meta reports; Meta does not split delivery by city, district, or radius.");
    return {
      ...accountShell(account, campaigns.summary, notes.join(" ")),
      segments,
      segment_results_label: scope.label,
    };
  } catch (error) {
    return failRow(account, performanceErrorMessage(error, "Meta Ads authorization expired. Reconnect the account."), "purchases");
  }
}

async function metaPerformance(
  ctx: ReadContext,
  account: AccountRef,
  start: string,
  end: string,
): Promise<PerformanceRow> {
  try {
    const { summary, rows, moreRemain } = await metaEntityRows(ctx, account, "campaign", start, end);
    const totals = summary;
    const listed = rows.map((raw) => {
      const result = metaCampaignResult(raw);
      return {
        id: String(raw.campaign_id ?? ""),
        name: campaignName(raw.campaign_name),
        spend: asNumber(raw.spend),
        impressions: asNumber(raw.impressions),
        clicks: asNumber(raw.clicks),
        reach: asNumber(raw.reach),
        results: result.results,
        results_label: result.results_label,
        result_value: result.result_value,
      };
    });
    const picked = topCampaigns(listed, moreRemain);
    const notes = [
      "Campaign tab. Account totals are the summary bar and can differ from adding the campaign rows.",
      "Meta results follow each campaign objective, like Results in Ads Manager.",
    ];
    if (picked.campaigns_truncated) {
      notes.push("Campaign list keeps the highest spend campaigns. The account total includes the rest.");
    }
    // Purchase-only accounts keep the summary bar purchases and value. Other results are added from campaigns.
    const onlyPurchases = listed.every((row) => row.results_label === "purchases");
    let accountResults: number | null = asNumber(totals.purchases);
    let accountLabel: string | null = "purchases";
    let accountValue: number | null = positiveOrNull(totals.purchase_conversion_value);
    if (!onlyPurchases) {
      const summed = metaAccountResult(listed, !moreRemain);
      accountResults = summed.result?.results ?? null;
      accountLabel = summed.result?.results_label ?? null;
      accountValue = null;
      if (summed.note) notes.push(summed.note);
    }
    return {
      platform: "meta",
      label: account.label,
      account_id: account.accountId,
      currency: typeof totals.currency === "string" && totals.currency.trim() ? totals.currency : null,
      spend: asNumber(totals.spend),
      impressions: asNumber(totals.impressions),
      clicks: asNumber(totals.clicks),
      reach: asNumber(totals.reach),
      results: accountResults,
      results_label: accountLabel,
      result_value: accountValue,
      campaigns: picked.campaigns,
      campaigns_truncated: picked.campaigns_truncated,
      error: null,
      note: notes.join(" "),
    };
  } catch (error) {
    return failRow(account, performanceErrorMessage(error, "Meta Ads authorization expired. Reconnect the account."), "purchases");
  }
}

async function tiktokPerformance(
  ctx: ReadContext,
  account: AccountRef,
  start: string,
  end: string,
): Promise<PerformanceRow> {
  try {
    const payload = await postDashboard("tiktok-ads-metrics", dashboardBody(ctx, {
      entity: "campaign",
      advertiser_id: account.accountId,
      date_start: start,
      date_end: end,
    }));
    const totals = recordOf(payload.summary);
    const listed = rowsOf(payload.rows).map((raw) => ({
      id: String(raw.campaign_id ?? ""),
      name: campaignName(raw.campaign_name),
      spend: asNumber(raw.spend),
      impressions: asNumber(raw.impressions),
      clicks: asNumber(raw.clicks),
      reach: asNumber(raw.reach),
      results: null,
      results_label: null,
      result_value: null,
    }));
    const picked = topCampaigns(listed, false);
    const notes = ["Campaign tab. Purchases and ROAS are not on this tab, so they are omitted."];
    if (picked.campaigns_truncated) {
      notes.push("Campaign list keeps the highest spend campaigns. The account total includes the rest.");
    }
    return {
      platform: "tiktok",
      label: account.label,
      account_id: account.accountId,
      currency: typeof totals.currency === "string" && totals.currency.trim() ? totals.currency : null,
      spend: asNumber(totals.spend),
      impressions: asNumber(totals.impressions),
      clicks: asNumber(totals.clicks),
      reach: asNumber(totals.reach),
      results: null,
      results_label: null,
      result_value: null,
      campaigns: picked.campaigns,
      campaigns_truncated: picked.campaigns_truncated,
      error: null,
      note: notes.join(" "),
    };
  } catch (error) {
    return failRow(
      account,
      performanceErrorMessage(error, "TikTok Ads authorization expired. Reconnect the account."),
      "conversions",
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const secret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !secret) {
    return json({ error: "misconfigured" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
  const door = internalDoor(req, body);
  if (door) return door;

  const userId = String(body.mcp_user_id ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(userId) || !uuid.test(organizationId)) return json({ error: "invalid_input" }, 400);

  const platformRaw = body.platform == null || body.platform === "" ? null : String(body.platform);
  if (platformRaw && platformRaw !== "google" && platformRaw !== "meta" && platformRaw !== "tiktok") {
    return json({ error: "invalid_input" }, 400);
  }
  const start = parseYmd(body.date_start);
  let end = parseYmd(body.date_end);
  if (!start || !end || start > end) return json({ error: "invalid_input" }, 400);

  // level campaign is the summary. adset and ad are Meta only, like those dashboard tabs.
  const levelRaw = body.level == null || body.level === "" ? "campaign" : String(body.level);
  if (levelRaw !== "campaign" && levelRaw !== "adset" && levelRaw !== "ad") {
    return json({ error: "invalid_input" }, 400);
  }
  const breakdown: BreakdownLevel | null = levelRaw === "campaign" ? null : levelRaw;
  if (breakdown && platformRaw && platformRaw !== "meta") return json({ error: "invalid_input" }, 400);
  const digits = (value: unknown): string | null | false => {
    if (value == null || value === "") return null;
    const text = String(value).trim();
    return /^\d{1,30}$/.test(text) ? text : false;
  };
  const accountFilter = digits(body.account_id);
  const campaignFilter = digits(body.campaign_id);
  const adsetFilter = digits(body.adset_id);
  const adFilter = digits(body.ad_id);
  if (accountFilter === false || campaignFilter === false || adsetFilter === false || adFilter === false) {
    return json({ error: "invalid_input" }, 400);
  }

  // mode performance is the summary or breakdown. audience and segments are Meta only.
  const modeRaw = body.mode == null || body.mode === "" ? "performance" : String(body.mode);
  if (modeRaw !== "performance" && modeRaw !== "audience" && modeRaw !== "segments") {
    return json({ error: "invalid_input" }, 400);
  }
  const mode = modeRaw as Mode;
  if (mode !== "performance" && (breakdown || (platformRaw && platformRaw !== "meta"))) {
    return json({ error: "invalid_input" }, 400);
  }
  if (campaignFilter && !breakdown && mode === "performance") return json({ error: "invalid_input" }, 400);
  if ((adsetFilter || adFilter) && mode === "performance") return json({ error: "invalid_input" }, 400);
  if (adFilter && mode === "audience") return json({ error: "invalid_input" }, 400);
  let dimensions: SegmentDimension[] = [...SEGMENT_DIMENSIONS];
  if (Array.isArray(body.dimensions) && body.dimensions.length > 0) {
    const picked = body.dimensions.map((item) => String(item ?? "").trim());
    if (picked.some((item) => !(SEGMENT_DIMENSIONS as readonly string[]).includes(item))) {
      return json({ error: "invalid_input" }, 400);
    }
    dimensions = [...new Set(picked)] as SegmentDimension[];
  }
  const filters: MetaFilters = {
    campaignId: campaignFilter || null,
    adsetId: adsetFilter || null,
    adId: adFilter || null,
  };

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const membership = await describeOrganizationMembership(admin, userId, organizationId);
  if (membership.state === "policy") {
    return reject("database_policy", "forbidden: database policy denied (table user_organizations)", 403, {
      organizationId,
      userId,
    });
  }
  if (membership.state === "query_failed") {
    return reject("database_query_failed", "performance_unavailable", 500, {
      organizationId,
      userId,
      table: membership.table,
    });
  }
  if (membership.state !== "active") {
    return reject("organization_mismatch", "forbidden: organization mismatch", 403, {
      organizationId,
      userId,
    });
  }

  let clipped = false;
  if (inclusiveDays(start, end) > MAX_INCLUSIVE_DAYS) {
    const nextStart = shiftYmd(end, -(MAX_INCLUSIVE_DAYS - 1));
    body.date_start = nextStart;
    clipped = true;
  }
  const dateStart = String(body.date_start);
  end = String(body.date_end);

  try {
    const loaded = await loadAccounts(
      admin,
      organizationId,
      breakdown || mode !== "performance" ? "meta" : platformRaw as Platform | null,
    );
    // The same Meta account can be connected twice; read it once.
    const seen = new Set<string>();
    const selected = loaded.accounts.filter((account) => {
      if (accountFilter && account.accountId.replace(/^act_/, "") !== accountFilter) return false;
      const key = `${account.platform}:${account.accountId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const ctx: ReadContext = { userId, organizationId, secret };
    const accounts = await Promise.all(selected.map((account) => {
      if (mode === "audience") return metaAudience(ctx, account, dateStart, end, filters);
      if (mode === "segments") return metaSegments(ctx, account, dateStart, end, filters, dimensions);
      if (breakdown) return metaBreakdown(ctx, account, breakdown, dateStart, end, campaignFilter || null);
      if (account.platform === "google") return googlePerformance(ctx, account, dateStart, end);
      if (account.platform === "meta") return metaPerformance(ctx, account, dateStart, end);
      return tiktokPerformance(ctx, account, dateStart, end);
    }));
    return json({
      period: { start: dateStart, end, clipped },
      level: levelRaw,
      mode,
      matches_dashboard: true,
      truncated: loaded.truncated,
      accounts,
    });
  } catch (error) {
    console.error("mcp-ads-performance:", publicError(error));
    return json({ error: "performance_unavailable" }, 500);
  }
});
