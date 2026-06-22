/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  requireTikTokShopPlatformConfigured,
  readPlatformTikTokShopOAuth,
  tiktokShopCorsHeaders,
  tiktokShopJson,
} from "../_shared/tiktokShopAuth.ts";
import {
  aggregateOrderSearchPages,
  buildTikTokShopOrdersCachePageToken,
  getTikTokShopOrderDetails,
  searchTikTokShopOrders,
  summarizeTikTokShopOrders,
  TIKTOK_SHOP_PERIOD_SUMMARY_CACHE_TOKEN,
} from "../_shared/tiktokShopApi.ts";
import { resolveOrgTikTokShopForOrders, withTikTokShopAccessTokenRetry } from "../_shared/tiktokShopOrgResolver.ts";
import { isTikTokShopScopeOrAuthError } from "../_shared/tiktokShopAuthErrors.ts";

const CACHE_TTL_MINUTES = 10;
const MAX_LOOKBACK_DAYS = 365;

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampTikTokShopDateRange(startYmd: string, endYmd: string, now = new Date()) {
  const minStart = new Date(now);
  minStart.setDate(minStart.getDate() - MAX_LOOKBACK_DAYS);
  let start = parseYmd(startYmd) ?? minStart;
  let end = parseYmd(endYmd) ?? now;
  if (start.getTime() < minStart.getTime()) start = minStart;
  if (start.getTime() > end.getTime()) start = end;
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
}

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
}

function ymdToUnixRange(dateStart: string, dateEnd: string): { ge: number; lt: number } {
  const start = parseYmd(dateStart) ?? new Date();
  const end = parseYmd(dateEnd) ?? new Date();
  const ge = Math.floor(new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() / 1000);
  const lt = Math.floor(
    new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).getTime() / 1000,
  ) + 1;
  return { ge, lt };
}

function apiErrorResponse(
  e: unknown,
  shopId: string,
  shopAccountId: string,
): Response {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("tiktok-shop-metrics api:", msg);
  const code = isTikTokShopScopeOrAuthError(msg) ? "TIKTOK_SHOP_SCOPE_ERROR" : "TIKTOK_SHOP_API_ERROR";
  return tiktokShopJson({ error: msg, code, shop_id: shopId, shop_account_id: shopAccountId }, 400);
}

async function readOrdersCache(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  shopId: string,
  dateStart: string,
  dateEnd: string,
  cachePageToken: string,
  now: Date,
) {
  const { data: cached, error: cacheReadErr } = await admin
    .from("organization_tiktok_shop_orders_cache")
    .select("response_json, fetched_at")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .eq("date_start", dateStart)
    .eq("date_end", dateEnd)
    .eq("page_token", cachePageToken)
    .gt("expires_at", now.toISOString())
    .maybeSingle();
  if (cacheReadErr) {
    console.warn("tiktok-shop-metrics cache read:", cacheReadErr.message);
    return null;
  }
  return cached?.response_json ?? null;
}

async function writeOrdersCache(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  shopId: string,
  dateStart: string,
  dateEnd: string,
  cachePageToken: string,
  payload: object,
  now: Date,
) {
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60_000).toISOString();
  const { error: cacheErr } = await admin.from("organization_tiktok_shop_orders_cache").upsert({
    organization_id: organizationId,
    shop_id: shopId,
    date_start: dateStart,
    date_end: dateEnd,
    page_token: cachePageToken,
    response_json: payload,
    fetched_at: now.toISOString(),
    expires_at: expiresAt,
  }, {
    onConflict: "organization_id,shop_id,date_start,date_end,page_token",
  });
  if (cacheErr) {
    console.warn("tiktok-shop-metrics cache upsert:", cacheErr.message);
  }
}

async function handleGetOrderDashboard(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
  now: Date,
) {
  const dr = defaultDateRange();
  const rawStart = String(body.date_start ?? dr.start).trim();
  const rawEnd = String(body.date_end ?? dr.end).trim();
  const { start: dateStart, end: dateEnd } = clampTikTokShopDateRange(rawStart, rawEnd, now);

  const shopAccountId = body.shop_account_id != null
    ? String(body.shop_account_id).trim()
    : body.shop_id != null
      ? String(body.shop_id).trim()
      : null;
  const pageToken = body.page_token != null ? String(body.page_token).trim() : "";
  const orderStatus = body.order_status != null ? String(body.order_status).trim() : "";
  const forceRefresh = body.force_refresh === true;

  const resolved = await resolveOrgTikTokShopForOrders(admin, organizationId, shopAccountId);
  if (!resolved) {
    return tiktokShopJson({
      error: "TikTok Shop not connected or no shop configured",
      code: "TIKTOK_SHOP_NOT_CONNECTED",
    }, 400);
  }

  const { accessToken, account } = resolved;
  const shopId = account.shop_id;
  const cachePageToken = buildTikTokShopOrdersCachePageToken(pageToken, orderStatus);

  if (!forceRefresh) {
    const cached = await readOrdersCache(
      admin,
      organizationId,
      shopId,
      dateStart,
      dateEnd,
      cachePageToken,
      now,
    );
    if (cached) {
      return tiktokShopJson({ ...(cached as object), cached: true }, 200);
    }
  }

  const oauth = readPlatformTikTokShopOAuth();
  if (!oauth) return tiktokShopJson({ error: "Platform not configured" }, 503);

  const { ge, lt } = ymdToUnixRange(dateStart, dateEnd);

  try {
    const searchResult = await withTikTokShopAccessTokenRetry(
      admin,
      organizationId,
      account.seller_open_id,
      accessToken,
      (token) =>
        searchTikTokShopOrders(oauth, token, account.shop_cipher, {
          createTimeGe: ge,
          createTimeLt: lt,
          pageSize: 50,
          pageToken: pageToken || undefined,
          orderStatus: orderStatus || undefined,
        }),
    );

    const pageSummary = summarizeTikTokShopOrders(searchResult.orders);
    const payload = {
      summary: {
        gmv: pageSummary.gmv,
        order_count: searchResult.total_count ?? searchResult.orders.length,
        units_sold: pageSummary.units_sold,
        currency: pageSummary.currency,
      },
      rows: searchResult.orders,
      shop_account_id: account.id,
      shop_id: shopId,
      shop_name: account.shop_name ?? account.label,
      date_start: dateStart,
      date_end: dateEnd,
      order_status: orderStatus || null,
      next_page_token: searchResult.next_page_token,
      fetched_at: now.toISOString(),
    };

    await writeOrdersCache(
      admin,
      organizationId,
      shopId,
      dateStart,
      dateEnd,
      cachePageToken,
      payload,
      now,
    );

    return tiktokShopJson(payload, 200);
  } catch (e) {
    return apiErrorResponse(e, shopId, account.id);
  }
}

async function handleGetOrderPeriodSummary(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
  now: Date,
) {
  const dr = defaultDateRange();
  const rawStart = String(body.date_start ?? dr.start).trim();
  const rawEnd = String(body.date_end ?? dr.end).trim();
  const { start: dateStart, end: dateEnd } = clampTikTokShopDateRange(rawStart, rawEnd, now);

  const shopAccountId = body.shop_account_id != null
    ? String(body.shop_account_id).trim()
    : body.shop_id != null
      ? String(body.shop_id).trim()
      : null;
  const orderStatus = body.order_status != null ? String(body.order_status).trim() : "";
  const forceRefresh = body.force_refresh === true;

  const resolved = await resolveOrgTikTokShopForOrders(admin, organizationId, shopAccountId);
  if (!resolved) {
    return tiktokShopJson({
      error: "TikTok Shop not connected or no shop configured",
      code: "TIKTOK_SHOP_NOT_CONNECTED",
    }, 400);
  }

  const { accessToken, account } = resolved;
  const shopId = account.shop_id;
  const cachePageToken = buildTikTokShopOrdersCachePageToken(
    TIKTOK_SHOP_PERIOD_SUMMARY_CACHE_TOKEN,
    orderStatus,
  );

  if (!forceRefresh) {
    const cached = await readOrdersCache(
      admin,
      organizationId,
      shopId,
      dateStart,
      dateEnd,
      cachePageToken,
      now,
    );
    if (cached) {
      return tiktokShopJson({ ...(cached as object), cached: true }, 200);
    }
  }

  const oauth = readPlatformTikTokShopOAuth();
  if (!oauth) return tiktokShopJson({ error: "Platform not configured" }, 503);

  const { ge, lt } = ymdToUnixRange(dateStart, dateEnd);

  try {
    const summary = await withTikTokShopAccessTokenRetry(
      admin,
      organizationId,
      account.seller_open_id,
      accessToken,
      (token) =>
        aggregateOrderSearchPages(oauth, token, account.shop_cipher, {
          createTimeGe: ge,
          createTimeLt: lt,
          orderStatus: orderStatus || undefined,
        }),
    );

    const payload = {
      summary: {
        gmv: summary.gmv,
        order_count: summary.order_count,
        units_sold: summary.units_sold,
        currency: summary.currency,
        pages_fetched: summary.pages_fetched,
        truncated: summary.truncated,
      },
      shop_account_id: account.id,
      shop_id: shopId,
      shop_name: account.shop_name ?? account.label,
      date_start: dateStart,
      date_end: dateEnd,
      order_status: orderStatus || null,
      fetched_at: now.toISOString(),
    };

    await writeOrdersCache(
      admin,
      organizationId,
      shopId,
      dateStart,
      dateEnd,
      cachePageToken,
      payload,
      now,
    );

    return tiktokShopJson(payload, 200);
  } catch (e) {
    return apiErrorResponse(e, shopId, account.id);
  }
}

async function handleGetOrderDetail(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
) {
  const shopAccountId = body.shop_account_id != null
    ? String(body.shop_account_id).trim()
    : body.shop_id != null
      ? String(body.shop_id).trim()
      : null;

  const rawIds = body.order_ids ?? body.order_id_list;
  const orderIds: string[] = Array.isArray(rawIds)
    ? rawIds.map((id) => String(id).trim()).filter(Boolean)
    : rawIds != null
      ? [String(rawIds).trim()].filter(Boolean)
      : [];

  if (orderIds.length === 0) {
    return tiktokShopJson({ error: "Missing order_ids" }, 400);
  }

  const resolved = await resolveOrgTikTokShopForOrders(admin, organizationId, shopAccountId);
  if (!resolved) {
    return tiktokShopJson({
      error: "TikTok Shop not connected or no shop configured",
      code: "TIKTOK_SHOP_NOT_CONNECTED",
    }, 400);
  }

  const oauth = readPlatformTikTokShopOAuth();
  if (!oauth) return tiktokShopJson({ error: "Platform not configured" }, 503);

  const { accessToken, account } = resolved;

  try {
    const { orders } = await withTikTokShopAccessTokenRetry(
      admin,
      organizationId,
      account.seller_open_id,
      accessToken,
      (token) =>
        getTikTokShopOrderDetails(oauth, token, account.shop_cipher, orderIds).then(
          (result) => result,
        ),
    );
    return tiktokShopJson({
      orders,
      shop_account_id: account.id,
      shop_id: account.shop_id,
    }, 200);
  } catch (e) {
    return apiErrorResponse(e, account.shop_id, account.id);
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: tiktokShopCorsHeaders });
    }
    if (req.method !== "POST") {
      return tiktokShopJson({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return tiktokShopJson({ error: "Server misconfigured" }, 500);
    }

    const platformForbidden = requireTikTokShopPlatformConfigured();
    if (platformForbidden) return platformForbidden;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return tiktokShopJson({ error: "Invalid JSON body" }, 400);
    }

    const organizationId = String(body.organization_id ?? "").trim();
    if (!organizationId) return tiktokShopJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const action = String(body.action ?? "getOrderDashboard").trim();
    const now = new Date();

    if (action === "getOrderDashboard") {
      return await handleGetOrderDashboard(admin, body, organizationId, now);
    }
    if (action === "getOrderPeriodSummary") {
      return await handleGetOrderPeriodSummary(admin, body, organizationId, now);
    }
    if (action === "getOrderDetail") {
      return await handleGetOrderDetail(admin, body, organizationId);
    }

    return tiktokShopJson({ error: "Unknown action" }, 400);
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("tiktok-shop-metrics unhandled:", msg);
    return tiktokShopJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
});
