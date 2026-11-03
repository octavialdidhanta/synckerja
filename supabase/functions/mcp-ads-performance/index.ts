/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  credentialShape,
  describeOrganizationMembership,
  internalSecretMatches,
} from "../_shared/scheduledPosts/scheduledPostsInternalAuth.ts";
import { metaAccountResult, metaCampaignResult } from "./metaResults.ts";

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

async function metaPerformance(
  ctx: ReadContext,
  account: AccountRef,
  start: string,
  end: string,
): Promise<PerformanceRow> {
  try {
    const rows: Record<string, unknown>[] = [];
    let summary: Record<string, unknown> | null = null;
    let pageToken = "";
    let moreRemain = false;
    for (let page = 0; page < MAX_META_PAGES; page += 1) {
      const payload = await postDashboard("meta-ads-metrics", dashboardBody(ctx, {
        entity: "campaign",
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
    const totals = summary ?? {};
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
    const loaded = await loadAccounts(admin, organizationId, platformRaw as Platform | null);
    const ctx: ReadContext = { userId, organizationId, secret };
    const accounts = await Promise.all(loaded.accounts.map((account) => {
      if (account.platform === "google") return googlePerformance(ctx, account, dateStart, end);
      if (account.platform === "meta") return metaPerformance(ctx, account, dateStart, end);
      return tiktokPerformance(ctx, account, dateStart, end);
    }));
    return json({
      period: { start: dateStart, end, clipped },
      matches_dashboard: true,
      truncated: loaded.truncated,
      accounts,
    });
  } catch (error) {
    console.error("mcp-ads-performance:", publicError(error));
    return json({ error: "performance_unavailable" }, 500);
  }
});
