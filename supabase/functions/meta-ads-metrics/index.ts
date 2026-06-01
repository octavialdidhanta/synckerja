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

type MetricEntity = "campaign" | "adset" | "ad";

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

  const entity = (String(body.entity ?? "campaign").trim() as MetricEntity) || "campaign";
  if (!ENTITY_LEVEL[entity]) {
    return metaAdsJson({ error: "Invalid entity" }, 400);
  }

  const dr = defaultDateRange();
  const dateStart = String(body.date_start ?? dr.start).trim();
  const dateEnd = String(body.date_end ?? dr.end).trim();
  const adAccountIdParam = body.ad_account_id != null ? String(body.ad_account_id).trim() : null;
  const pageToken = String(body.page_token ?? "").trim();

  const resolved = await resolveOrgMetaAdsForMetrics(admin, organizationId, adAccountIdParam);
  if (!resolved) {
    return metaAdsJson({ error: "Meta Ads not connected or no account configured" }, 400);
  }

  const { accessToken, account } = resolved;
  const act = metaActId(account.ad_account_id);
  const metricsKey = "default";
  const now = new Date();

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
  let path =
    `${act}/insights?fields=${INSIGHT_FIELDS}&level=${level}&time_range=${timeRange}&limit=100`;
  if (pageToken) path += `&after=${encodeURIComponent(pageToken)}`;

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

  let currency = "USD";
  for (const row of rows) {
    const r = row as { account_currency?: string };
    if (r.account_currency) {
      currency = r.account_currency;
      break;
    }
  }

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  for (const row of rows) {
    const r = row as { spend?: string; impressions?: string; clicks?: string };
    totalSpend += parseFloat(r.spend ?? "0") || 0;
    totalImpressions += parseInt(r.impressions ?? "0", 10) || 0;
    totalClicks += parseInt(r.clicks ?? "0", 10) || 0;
  }

  const responsePayload = {
    rows,
    summary: {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      currency,
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
