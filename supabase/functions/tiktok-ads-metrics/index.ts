/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  requireTikTokAdsPlatformConfigured,
  tiktokAdsCorsHeaders,
  tiktokAdsJson,
} from "../_shared/tiktokAdsAuth.ts";
import {
  fetchTikTokIntegratedReport,
  type TikTokMetricEntity,
} from "../_shared/tiktokAdsApi.ts";
import {
  aggregateTikTokRowsByService,
  enrichTikTokCampaignRowsWithServiceEconomics,
  handleUpsertTikTokCampaignServiceMapping,
} from "../_shared/tiktokAdsCampaignServices.ts";
import { resolveOrgTikTokAdsForMetrics } from "../_shared/tiktokAdsOrgResolver.ts";
import {
  buildChannelPeriodSummary,
  buildMonthWindowsInRange,
  emptySpendBucketsForWindows,
  monthPeriodKeyFromWindow,
  type MonthWindow,
} from "../_shared/monthlyReportAttribution.ts";

const CACHE_TTL_MINUTES = 10;
const METRICS_CACHE_KEY = "integrated-report-v1";
const MONTHLY_CACHE_KEY = "monthly-spend-v1";
const MAX_LOOKBACK_DAYS = 365;

type MetricEntity = TikTokMetricEntity;

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

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampTikTokDateRange(startYmd: string, endYmd: string, now = new Date()) {
  const minStart = new Date(now);
  minStart.setDate(minStart.getDate() - MAX_LOOKBACK_DAYS);
  let start = parseYmd(startYmd) ?? minStart;
  let end = parseYmd(endYmd) ?? now;
  if (start.getTime() < minStart.getTime()) start = minStart;
  if (start.getTime() > end.getTime()) start = end;
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
}

async function handleMonthlySpendBreakdown(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
  now: Date,
) {
  const year = Number(body.year ?? now.getFullYear());
  if (!Number.isFinite(year)) return tiktokAdsJson({ error: "Invalid year" }, 400);

  const advertiserIdParam = body.advertiser_id != null ? String(body.advertiser_id).trim() : null;
  const serviceIdFilter = body.service_id != null ? String(body.service_id).trim() : null;
  const forceRefresh = body.force_refresh === true;

  const resolved = await resolveOrgTikTokAdsForMetrics(admin, organizationId, advertiserIdParam);
  if (!resolved) {
    return tiktokAdsJson({ error: "TikTok Ads not connected or no account configured" }, 400);
  }

  const { accessToken, account } = resolved;
  const advertiserId = account.advertiser_id;
  const cacheKey = serviceIdFilter ? `${MONTHLY_CACHE_KEY}:svc:${serviceIdFilter}` : MONTHLY_CACHE_KEY;

  const rangeStart = `${year}-01-01`;
  const rangeEnd = `${year}-12-31`;
  const { start: dateStart, end: dateEnd } = clampTikTokDateRange(rangeStart, rangeEnd, now);

  if (!forceRefresh) {
    const { data: cached } = await admin
      .from("tiktok_ads_metrics_cache")
      .select("response_json, fetched_at")
      .eq("organization_id", organizationId)
      .eq("advertiser_id", advertiserId)
      .eq("entity", "campaign")
      .eq("date_start", dateStart)
      .eq("date_end", dateEnd)
      .eq("metrics_key", cacheKey)
      .eq("page_token", "")
      .gt("expires_at", now.toISOString())
      .maybeSingle();
    if (cached?.response_json) {
      return tiktokAdsJson({ ...(cached.response_json as object), cached: true }, 200);
    }
  }

  const windows = buildMonthWindowsInRange(dateStart, dateEnd).filter((w) => w.year === year);
  const months = emptySpendBucketsForWindows(windows);

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i] as MonthWindow;
    try {
      const { summary } = await fetchTikTokIntegratedReport(
        accessToken,
        advertiserId,
        "campaign",
        w.start,
        w.end,
      );
      months[i].spend = summary.spend as number ?? 0;
    } catch (e) {
      console.warn("tiktok monthly window:", w.start, w.end, e);
    }
  }

  const statusRes = await admin
    .from("lead_statuses")
    .select("id, name")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`);
  const convertedStatusIds = (statusRes.data ?? [])
    .filter((r) => String((r as { name?: string }).name ?? "").trim().toLowerCase() === "converted")
    .map((r) => String((r as { id: string }).id));

  if (convertedStatusIds.length > 0) {
    const { data: leads } = await admin
      .from("leads")
      .select("id, attribution, converted_at")
      .eq("organization_id", organizationId)
      .in("status_id", convertedStatusIds)
      .not("converted_at", "is", null)
      .gte("converted_at", `${dateStart}T00:00:00.000Z`)
      .lte("converted_at", `${dateEnd}T23:59:59.999Z`);

    for (const lead of leads ?? []) {
      const attr = (lead as { attribution: unknown }).attribution;
      let source = "";
      if (attr && typeof attr === "object" && !Array.isArray(attr)) {
        source = String((attr as Record<string, unknown>).utm_source ?? "").toLowerCase();
      }
      if (!source.includes("tiktok")) continue;
      const convertedAt = String((lead as { converted_at: string }).converted_at);
      const d = new Date(convertedAt);
      if (Number.isNaN(d.getTime())) continue;
      const bucket = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth() + 1);
      if (bucket) bucket.converted_leads = (bucket.converted_leads ?? 0) + 1;
    }
  }

  for (const bucket of months) {
    bucket.cpa = bucket.converted_leads > 0 ? bucket.spend / bucket.converted_leads : null;
  }

  const periodSummary = buildChannelPeriodSummary(months);
  const currency = String(
    (await fetchTikTokIntegratedReport(accessToken, advertiserId, "campaign", dateStart, dateEnd))
      .summary.currency ?? "USD",
  );

  const payload = {
    year,
    currency,
    months,
    period_summary: periodSummary,
    advertiser_id: advertiserId,
    date_start: dateStart,
    date_end: dateEnd,
    service_id: serviceIdFilter,
    fetched_at: now.toISOString(),
  };

  const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60_000).toISOString();
  await admin.from("tiktok_ads_metrics_cache").upsert({
    organization_id: organizationId,
    advertiser_id: advertiserId,
    entity: "campaign",
    date_start: dateStart,
    date_end: dateEnd,
    metrics_key: cacheKey,
    page_token: "",
    response_json: payload,
    fetched_at: now.toISOString(),
    expires_at: expiresAt,
  }, { onConflict: "organization_id,advertiser_id,entity,date_start,date_end,metrics_key,page_token" });

  return tiktokAdsJson(payload, 200);
}

Deno.serve(async (req: Request) => {
  try {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: tiktokAdsCorsHeaders });
  }
  if (req.method !== "POST") {
    return tiktokAdsJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return tiktokAdsJson({ error: "Server misconfigured" }, 500);
  }

  const platformForbidden = requireTikTokAdsPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return tiktokAdsJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return tiktokAdsJson({ error: "Missing organization_id" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
  if (orgForbidden) return orgForbidden;

  const action = String(body.action ?? "").trim();
  const now = new Date();

  if (body.monthly_breakdown === true) {
    return await handleMonthlySpendBreakdown(admin, body, organizationId, now);
  }

  if (action === "upsertCampaignServiceMapping") {
    const advertiserId = String(body.advertiser_id ?? "").trim();
    const campaignId = String(body.campaign_id ?? "").trim();
    const serviceId = body.service_id != null ? String(body.service_id).trim() : null;
    if (!advertiserId || !campaignId) {
      return tiktokAdsJson({ error: "Missing advertiser_id or campaign_id" }, 400);
    }
    try {
      const result = await handleUpsertTikTokCampaignServiceMapping(
        admin,
        organizationId,
        userRes.userId,
        advertiserId,
        campaignId,
        serviceId,
      );
      return tiktokAdsJson({ ok: true, mapping: result.mapping }, 200);
    } catch (e) {
      return tiktokAdsJson({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  if (action === "fetchReportByService") {
    const dr = defaultDateRange();
    const rawStart = String(body.date_start ?? dr.start).trim();
    const rawEnd = String(body.date_end ?? dr.end).trim();
    const { start: dateStart, end: dateEnd } = clampTikTokDateRange(rawStart, rawEnd, now);
    const advertiserIdParam = body.advertiser_id != null ? String(body.advertiser_id).trim() : null;
    const unmappedLabel = String(body.unmapped_label ?? "Unmapped").trim() || "Unmapped";

    const resolved = await resolveOrgTikTokAdsForMetrics(admin, organizationId, advertiserIdParam);
    if (!resolved) {
      return tiktokAdsJson({ error: "TikTok Ads not connected or no account configured" }, 400);
    }

    const { accessToken, account } = resolved;
    let rows: Record<string, unknown>[];
    let summary: Record<string, unknown>;
    try {
      ({ rows, summary } = await fetchTikTokIntegratedReport(
        accessToken,
        account.advertiser_id,
        "campaign",
        dateStart,
        dateEnd,
      ));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("tiktok-ads-metrics fetchReportByService:", msg);
      return tiktokAdsJson({ error: msg, code: "TIKTOK_ADS_API_ERROR" }, 400);
    }
    await enrichTikTokCampaignRowsWithServiceEconomics(
      admin,
      organizationId,
      account.advertiser_id,
      rows,
      dateStart,
      dateEnd,
    );
    const reportRows = aggregateTikTokRowsByService(rows, unmappedLabel);
    return tiktokAdsJson({
      rows: reportRows,
      currency_code: summary.currency ?? "USD",
      date_start: dateStart,
      date_end: dateEnd,
    }, 200);
  }

  const entity = (String(body.entity ?? "campaign").trim() as MetricEntity) || "campaign";
  if (!["campaign", "adgroup", "ad"].includes(entity)) {
    return tiktokAdsJson({ error: "Invalid entity" }, 400);
  }

  const dr = defaultDateRange();
  const rawStart = String(body.date_start ?? dr.start).trim();
  const rawEnd = String(body.date_end ?? dr.end).trim();
  const { start: dateStart, end: dateEnd } = clampTikTokDateRange(rawStart, rawEnd, now);
  const advertiserIdParam = body.advertiser_id != null ? String(body.advertiser_id).trim() : null;
  const forceRefresh = body.force_refresh === true;

  const resolved = await resolveOrgTikTokAdsForMetrics(admin, organizationId, advertiserIdParam);
  if (!resolved) {
    return tiktokAdsJson({ error: "TikTok Ads not connected or no account configured" }, 400);
  }

  const { accessToken, account } = resolved;

  if (!forceRefresh) {
    const { data: cached } = await admin
      .from("tiktok_ads_metrics_cache")
      .select("response_json, fetched_at")
      .eq("organization_id", organizationId)
      .eq("advertiser_id", account.advertiser_id)
      .eq("entity", entity)
      .eq("date_start", dateStart)
      .eq("date_end", dateEnd)
      .eq("metrics_key", METRICS_CACHE_KEY)
      .eq("page_token", "")
      .gt("expires_at", now.toISOString())
      .maybeSingle();
    if (cached?.response_json) {
      return tiktokAdsJson({ ...(cached.response_json as object), cached: true }, 200);
    }
  }

  let rows: Record<string, unknown>[];
  let summary: Record<string, unknown>;
  try {
    ({ rows, summary } = await fetchTikTokIntegratedReport(
      accessToken,
      account.advertiser_id,
      entity,
      dateStart,
      dateEnd,
    ));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("tiktok-ads-metrics fetchReport:", msg);
    return tiktokAdsJson({ error: msg, code: "TIKTOK_ADS_API_ERROR" }, 400);
  }

  if (entity === "campaign") {
    await enrichTikTokCampaignRowsWithServiceEconomics(
      admin,
      organizationId,
      account.advertiser_id,
      rows,
      dateStart,
      dateEnd,
    );
  }

  const payload = {
    rows,
    summary: {
      spend: summary.spend,
      impressions: summary.impressions,
      clicks: summary.clicks,
      reach: summary.reach,
      currency: summary.currency,
    },
    entity,
    advertiser_id: account.advertiser_id,
    ad_account_id: account.advertiser_id,
    date_start: dateStart,
    date_end: dateEnd,
    next_page_token: null,
    fetched_at: now.toISOString(),
  };

  const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60_000).toISOString();
  await admin.from("tiktok_ads_metrics_cache").upsert({
    organization_id: organizationId,
    advertiser_id: account.advertiser_id,
    entity,
    date_start: dateStart,
    date_end: dateEnd,
    metrics_key: METRICS_CACHE_KEY,
    page_token: "",
    response_json: payload,
    fetched_at: now.toISOString(),
    expires_at: expiresAt,
  }, { onConflict: "organization_id,advertiser_id,entity,date_start,date_end,metrics_key,page_token" });

  return tiktokAdsJson(payload, 200);
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("tiktok-ads-metrics unhandled:", msg);
    return tiktokAdsJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
});
