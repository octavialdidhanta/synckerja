/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  metaAdsCorsHeaders,
  metaAdsJson,
  metaGraphVersion,
  readPlatformMetaAdsOAuth,
} from "../_shared/metaAdsAuth.ts";
import { metaActId, resolveOrgMetaAdsForMetrics } from "../_shared/metaAdsOrgResolver.ts";

const CACHE_TTL_MINUTES = 10;

/** Bust cache when summary aggregation logic changes. */
const METRICS_CACHE_KEY = "account-insights-v3";

const MONTHLY_SPEND_CACHE_KEY = "monthly-spend-v2";

const ACCOUNT_SUMMARY_FIELDS = "spend,impressions,clicks,account_currency";

/** Match Ads Manager attribution (unified ad-set settings). */
const INSIGHTS_ATTRIBUTION_PARAMS = "use_unified_attribution_setting=true";

type MetricEntity = "campaign" | "adset" | "ad";

function entityEffectiveStatusField(entity: MetricEntity): string {
  if (entity === "campaign") return "campaign.effective_status";
  if (entity === "adset") return "adset.effective_status";
  return "ad.effective_status";
}

/** Exclude deleted/archived entities — closer to default Ads Manager tables. */
function entityInsightsFiltering(entity: MetricEntity): string {
  return encodeURIComponent(
    JSON.stringify([
      {
        field: entityEffectiveStatusField(entity),
        operator: "NOT_IN",
        value: ["DELETED", "ARCHIVED"],
      },
    ]),
  );
}

const ENTITY_LEVEL: Record<MetricEntity, string> = {
  campaign: "campaign",
  adset: "adset",
  ad: "ad",
};

const INSIGHT_FIELDS = [
  "campaign_name",
  "campaign_id",
  "adset_name",
  "adset_id",
  "ad_name",
  "ad_id",
  "spend",
  "impressions",
  "clicks",
  "cpc",
  "cpm",
  "ctr",
  "reach",
  "actions",
  "account_currency",
].join(",");

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
}

/** Meta Graph (#3018): start cannot be more than 37 months before today. */
const META_ADS_MAX_LOOKBACK_MONTHS = 37;

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function metaAdsEarliestAllowedStart(now: Date): Date {
  const today = startOfDayLocal(now);
  return new Date(
    today.getFullYear(),
    today.getMonth() - META_ADS_MAX_LOOKBACK_MONTHS,
    today.getDate(),
  );
}

function clampMetaAdsDateRange(
  startYmd: string,
  endYmd: string,
  now: Date = new Date(),
): { start: string; end: string } {
  const minStart = metaAdsEarliestAllowedStart(now);
  let start = parseYmd(startYmd) ?? minStart;
  let end = parseYmd(endYmd) ?? startOfDayLocal(now);
  start = startOfDayLocal(start);
  end = startOfDayLocal(end);
  if (start.getTime() < minStart.getTime()) start = minStart;
  if (start.getTime() > end.getTime()) start = end;
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
}

type AccountSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  currency: string;
};

/** Sum ad-level insights — matches Meta Ads Manager Ads tab footer totals. */
async function fetchAdsManagerAlignedSummary(
  graphVersion: string,
  act: string,
  timeRangeEncoded: string,
  accessToken: string,
): Promise<AccountSummary> {
  const fields = ACCOUNT_SUMMARY_FIELDS;
  const filtering = entityInsightsFiltering("ad");
  let path =
    `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_range=${timeRangeEncoded}&limit=500`;

  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let currency = "USD";

  for (let page = 0; page < 50; page++) {
    const url =
      `https://graph.facebook.com/${graphVersion}/${path}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const rows = (json as { data?: unknown[] })?.data ?? [];
    for (const row of rows) {
      const r = row as {
        spend?: string;
        impressions?: string;
        clicks?: string;
        account_currency?: string;
      };
      spend += parseFloat(r.spend ?? "0") || 0;
      impressions += parseInt(r.impressions ?? "0", 10) || 0;
      clicks += parseInt(r.clicks ?? "0", 10) || 0;
      if (r.account_currency) currency = r.account_currency;
    }

    const paging = (json as { paging?: { cursors?: { after?: string } } })?.paging;
    const after = paging?.cursors?.after;
    if (!after) break;
    path =
      `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_range=${timeRangeEncoded}&limit=500&after=${encodeURIComponent(after)}`;
  }

  return { spend, impressions, clicks, currency };
}

type MonthlySpendBucket = { month: number; spend: number };

function emptyMonthlySpendBuckets(): MonthlySpendBucket[] {
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, spend: 0 }));
}

function parseMonthlySpendIndex(dateStart: string, year: number): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(String(dateStart).trim());
  if (!m || Number(m[1]) !== year) return null;
  const idx = Number(m[2]);
  return idx >= 1 && idx <= 12 ? idx : null;
}

/** Monthly spend from ad-level insights — matches table summary & Ads Manager. */
async function fetchMonthlyAdsManagerAlignedSpend(
  graphVersion: string,
  act: string,
  timeRangeEncoded: string,
  accessToken: string,
  year: number,
): Promise<{ months: MonthlySpendBucket[]; currency: string }> {
  const fields = "spend,account_currency,date_start,date_stop";
  const filtering = entityInsightsFiltering("ad");
  let path =
    `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_increment=monthly&time_range=${timeRangeEncoded}&limit=500`;
  const buckets = emptyMonthlySpendBuckets();
  let currency = "USD";

  for (let page = 0; page < 50; page++) {
    const url =
      `https://graph.facebook.com/${graphVersion}/${path}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const rows = (json as { data?: unknown[] })?.data ?? [];
    for (const row of rows) {
      const r = row as {
        spend?: string;
        account_currency?: string;
        date_start?: string;
      };
      if (r.account_currency) currency = r.account_currency;
      const monthIdx = parseMonthlySpendIndex(String(r.date_start ?? ""), year);
      if (monthIdx == null) continue;
      const spend = parseFloat(r.spend ?? "0") || 0;
      buckets[monthIdx - 1]!.spend += spend;
    }

    const paging = (json as { paging?: { cursors?: { after?: string } } })?.paging;
    const after = paging?.cursors?.after;
    if (!after) break;
    path =
      `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_increment=monthly&time_range=${timeRangeEncoded}&limit=500&after=${encodeURIComponent(after)}`;
  }

  return { months: buckets, currency };
}

async function handleMonthlySpendBreakdown(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
  now: Date,
): Promise<Response> {
  const yearRaw = Number(body.year);
  const year = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100
    ? Math.floor(yearRaw)
    : now.getFullYear();

  const adAccountIdParam = body.ad_account_id != null ? String(body.ad_account_id).trim() : null;
  const resolved = await resolveOrgMetaAdsForMetrics(admin, organizationId, adAccountIdParam);
  if (!resolved) {
    return metaAdsJson({ error: "Meta Ads not connected or no account configured" }, 400);
  }

  const { accessToken, account } = resolved;
  const act = metaActId(account.ad_account_id);
  const startOverride = body.date_start != null ? String(body.date_start).trim() : "";
  const start = startOverride || `${year}-01-01`;
  const defaultEnd = year === now.getFullYear() ? formatDateYmd(now) : `${year}-12-31`;
  const endOverride = body.date_end != null ? String(body.date_end).trim() : "";
  const end = endOverride || defaultEnd;
  const { start: dateStart, end: dateEnd } = clampMetaAdsDateRange(start, end, now);

  const { data: cached } = await admin
    .from("meta_ads_metrics_cache")
    .select("response_json, fetched_at, expires_at")
    .eq("organization_id", organizationId)
    .eq("ad_account_id", account.ad_account_id)
    .eq("entity", "campaign")
    .eq("date_start", dateStart)
    .eq("date_end", dateEnd)
    .eq("metrics_key", MONTHLY_SPEND_CACHE_KEY)
    .eq("page_token", "")
    .maybeSingle();

  if (cached?.expires_at && new Date(String(cached.expires_at)).getTime() > now.getTime()) {
    return metaAdsJson({
      ...(cached.response_json as object),
      cached: true,
      fetched_at: cached.fetched_at,
    }, 200);
  }

  const v = metaGraphVersion();
  const timeRange = encodeURIComponent(JSON.stringify({ since: dateStart, until: dateEnd }));

  try {
    const { months, currency } = await fetchMonthlyAdsManagerAlignedSpend(
      v,
      act,
      timeRange,
      accessToken,
      year,
    );

    const responsePayload = {
      year,
      currency,
      months,
      ad_account_id: account.ad_account_id,
      date_start: dateStart,
      date_end: dateEnd,
      cached: false,
    };

    const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
    await admin.from("meta_ads_metrics_cache").upsert(
      {
        organization_id: organizationId,
        ad_account_id: account.ad_account_id,
        entity: "campaign",
        date_start: dateStart,
        date_end: dateEnd,
        metrics_key: MONTHLY_SPEND_CACHE_KEY,
        page_token: "",
        response_json: responsePayload,
        fetched_at: now.toISOString(),
        expires_at: expiresAt,
      },
      {
        onConflict:
          "organization_id,ad_account_id,entity,date_start,date_end,metrics_key,page_token",
      },
    );

    return metaAdsJson(responsePayload, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load monthly spend";
    return metaAdsJson({ error: msg }, 400);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: metaAdsCorsHeaders });
  }
  if (req.method !== "POST") {
    return metaAdsJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return metaAdsJson({ error: "Server misconfigured" }, 500);
  }

  if (!readPlatformMetaAdsOAuth()) {
    return metaAdsJson({ error: "Meta Ads is not configured on the server" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return metaAdsJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) {
    return metaAdsJson({ error: "Missing organization_id" }, 400);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.userId)
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null ? String(profile.active_organization_id) : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return metaAdsJson({ error: "Forbidden" }, 403);
  }

  const now = new Date();

  if (body.monthly_breakdown === true) {
    return await handleMonthlySpendBreakdown(admin, body, organizationId, now);
  }

  const entity = (String(body.entity ?? "campaign").trim() as MetricEntity) || "campaign";
  if (!ENTITY_LEVEL[entity]) {
    return metaAdsJson({ error: "Invalid entity" }, 400);
  }

  const dr = defaultDateRange();
  const rawStart = String(body.date_start ?? dr.start).trim();
  const rawEnd = String(body.date_end ?? dr.end).trim();
  const { start: dateStart, end: dateEnd } = clampMetaAdsDateRange(rawStart, rawEnd, now);
  const adAccountIdParam = body.ad_account_id != null ? String(body.ad_account_id).trim() : null;
  const pageToken = String(body.page_token ?? "").trim();

  const resolved = await resolveOrgMetaAdsForMetrics(admin, organizationId, adAccountIdParam);
  if (!resolved) {
    return metaAdsJson({ error: "Meta Ads not connected or no account configured" }, 400);
  }

  const { accessToken, account } = resolved;
  const act = metaActId(account.ad_account_id);
  const metricsKey = METRICS_CACHE_KEY;

  const { data: cached } = await admin
    .from("meta_ads_metrics_cache")
    .select("response_json, fetched_at, expires_at")
    .eq("organization_id", organizationId)
    .eq("ad_account_id", account.ad_account_id)
    .eq("entity", entity)
    .eq("date_start", dateStart)
    .eq("date_end", dateEnd)
    .eq("metrics_key", metricsKey)
    .eq("page_token", pageToken)
    .maybeSingle();

  if (cached?.expires_at && new Date(String(cached.expires_at)).getTime() > now.getTime()) {
    return metaAdsJson({
      ...(cached.response_json as object),
      cached: true,
      fetched_at: cached.fetched_at,
    }, 200);
  }

  const v = metaGraphVersion();
  const timeRange = encodeURIComponent(JSON.stringify({ since: dateStart, until: dateEnd }));
  const level = ENTITY_LEVEL[entity];
  const filtering = entityInsightsFiltering(entity);
  let path =
    `${act}/insights?fields=${INSIGHT_FIELDS}&level=${level}&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_range=${timeRange}&limit=100`;
  if (pageToken) path += `&after=${encodeURIComponent(pageToken)}`;

  let summary: AccountSummary;
  try {
    if (!pageToken) {
      summary = await fetchAdsManagerAlignedSummary(v, act, timeRange, accessToken);
    } else {
      const { data: summaryCache } = await admin
        .from("meta_ads_metrics_cache")
        .select("response_json")
        .eq("organization_id", organizationId)
        .eq("ad_account_id", account.ad_account_id)
        .eq("entity", entity)
        .eq("date_start", dateStart)
        .eq("date_end", dateEnd)
        .eq("metrics_key", metricsKey)
        .eq("page_token", "")
        .maybeSingle();
      const cachedSummary = (summaryCache?.response_json as { summary?: AccountSummary } | null)
        ?.summary;
      summary = cachedSummary ??
        await fetchAdsManagerAlignedSummary(v, act, timeRange, accessToken);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load account summary";
    return metaAdsJson({ error: msg }, 400);
  }

  const url = `https://graph.facebook.com/${v}/${path}&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    return metaAdsJson({ error: msg }, 400);
  }

  const rows = (json as { data?: unknown[] })?.data ?? [];
  const paging = (json as { paging?: { cursors?: { after?: string }; next?: string } })?.paging;
  const nextPageToken = paging?.cursors?.after ?? "";

  const responsePayload = {
    rows,
    summary: {
      spend: summary.spend,
      impressions: summary.impressions,
      clicks: summary.clicks,
      currency: summary.currency,
    },
    entity,
    ad_account_id: account.ad_account_id,
    date_start: dateStart,
    date_end: dateEnd,
    next_page_token: nextPageToken || null,
    cached: false,
  };

  const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
  await admin.from("meta_ads_metrics_cache").upsert(
    {
      organization_id: organizationId,
      ad_account_id: account.ad_account_id,
      entity,
      date_start: dateStart,
      date_end: dateEnd,
      metrics_key: metricsKey,
      page_token: pageToken,
      response_json: responsePayload,
      fetched_at: now.toISOString(),
      expires_at: expiresAt,
    },
    {
      onConflict:
        "organization_id,ad_account_id,entity,date_start,date_end,metrics_key,page_token",
    },
  );

  return metaAdsJson({ ...responsePayload, fetched_at: now.toISOString() }, 200);
});
