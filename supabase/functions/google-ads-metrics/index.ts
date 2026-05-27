/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  googleAdsCorsHeaders,
  googleAdsJson,
  readPlatformGoogleAdsOAuth,
  requireOrgAdmin,
} from "../_shared/googleAdsAuth.ts";
import { gaqlSearchPage } from "../_shared/googleAdsGaql.ts";
import {
  buildGaqlQuery,
  buildMetricsKey,
  getMetricCatalogForApi,
  normalizeGaqlRow,
  isAdCreativeGaqlError,
  parseUnsupportedMetricsFromError,
  resolveMetrics,
  rowPassesDeliveryFilter,
  validateMetricsCount,
  type MetricEntity,
} from "../_shared/googleAdsMetricsCatalog.ts";
import { enrichAdRowsWithPreviews } from "../_shared/googleAdsAdPreview.ts";
import { resolveOrgGoogleAdsForUpload } from "../_shared/googleAdsOrgResolver.ts";
import { fetchGoogleAdsAccessToken } from "../google-ads-upload-offline-conversion/googleAdsHelpers.ts";

const CACHE_TTL_MINUTES = 10;
const DEFAULT_PAGE_SIZE = 50;

function digitsOnly(value: string, len?: number): string {
  const d = value.replace(/\D/g, "");
  if (len != null && d.length !== len) return "";
  return d;
}

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveDateRange(
  dateRange: unknown,
): { clause: string; dateStart: string; dateEnd: string } {
  const today = new Date();
  const defaultEnd = formatDateYmd(today);
  const defaultStartDate = new Date(today);
  defaultStartDate.setDate(defaultStartDate.getDate() - 6);
  const defaultStart = formatDateYmd(defaultStartDate);

  if (dateRange && typeof dateRange === "object" && !Array.isArray(dateRange)) {
    const dr = dateRange as { preset?: string; start?: string; end?: string };
    const preset = String(dr.preset ?? "").trim().toUpperCase();
    if (preset === "TODAY") {
      const start = String(dr.start ?? "").trim();
      const end = String(dr.end ?? "").trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return {
          clause: `segments.date BETWEEN '${start}' AND '${end}'`,
          dateStart: start,
          dateEnd: end,
        };
      }
      return {
        clause: "segments.date DURING TODAY",
        dateStart: defaultEnd,
        dateEnd: defaultEnd,
      };
    }
    if (preset === "LAST_7_DAYS") {
      return {
        clause: "segments.date DURING LAST_7_DAYS",
        dateStart: defaultStart,
        dateEnd: defaultEnd,
      };
    }
    if (preset === "LAST_30_DAYS") {
      const start30 = new Date(today);
      start30.setDate(start30.getDate() - 29);
      return {
        clause: "segments.date DURING LAST_30_DAYS",
        dateStart: formatDateYmd(start30),
        dateEnd: defaultEnd,
      };
    }
    const start = String(dr.start ?? "").trim();
    const end = String(dr.end ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return {
        clause: `segments.date BETWEEN '${start}' AND '${end}'`,
        dateStart: start,
        dateEnd: end,
      };
    }
  }

  return {
    clause: "segments.date DURING TODAY",
    dateStart: defaultEnd,
    dateEnd: defaultEnd,
  };
}

function parseEntity(raw: unknown): MetricEntity | null {
  const e = String(raw ?? "").trim();
  if (e === "campaign" || e === "ad_group" || e === "ad") return e;
  return null;
}

function parseSortKey(raw: unknown): string {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const s = raw as { field?: string; direction?: string };
    const field = String(s.field ?? "spent").trim() || "spent";
    const dir = String(s.direction ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
    return `${field}:${dir}`;
  }
  return "spent:desc";
}

async function findAccountIdForCustomer(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  customerId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("organization_google_ads_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("is_active", true)
    .maybeSingle();
  return data?.id != null ? String(data.id) : null;
}

type CachePayload = {
  customer_id: string;
  currency_code: string | null;
  entity: MetricEntity;
  date_range: { start: string; end: string };
  rows: ReturnType<typeof normalizeGaqlRow>[];
  next_page_token: string | null;
  fetched_at: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: googleAdsCorsHeaders });
  }
  if (req.method !== "POST") {
    return googleAdsJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return googleAdsJson({ error: "Server misconfigured" }, 500);
  }

  if (!readPlatformGoogleAdsOAuth()) {
    return googleAdsJson({ error: "Google Ads is not configured on the server" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return googleAdsJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "fetchMetrics").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) {
    return googleAdsJson({ error: "Missing organization_id" }, 400);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.userId)
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null
    ? String(profile.active_organization_id)
    : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return googleAdsJson({ error: "Forbidden" }, 403);
  }

  const forbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (forbidden) return forbidden;

  if (action === "listMetricCatalog") {
    const entity = parseEntity(body.entity);
    return googleAdsJson(getMetricCatalogForApi(entity ?? undefined), 200);
  }

  if (action !== "fetchMetrics") {
    return googleAdsJson({ error: "Unknown action" }, 400);
  }

  const customerId = digitsOnly(String(body.customer_id ?? ""), 10);
  if (!customerId) {
    return googleAdsJson({ error: "customer_id required (10 digits)" }, 400);
  }

  const entity = parseEntity(body.entity);
  if (!entity) {
    return googleAdsJson({ error: "entity must be campaign, ad_group, or ad" }, 400);
  }

  const metricKeysRaw = Array.isArray(body.metrics)
    ? (body.metrics as unknown[]).map((k) => String(k))
    : [];
  const countErr = validateMetricsCount(metricKeysRaw);
  if (countErr) return googleAdsJson({ error: countErr }, 400);

  const { defs: metricDefs, invalid } = resolveMetrics(metricKeysRaw, entity);
  if (invalid.length > 0) {
    return googleAdsJson({ error: "Invalid metrics for entity", invalid_metrics: invalid }, 400);
  }

  const accountId = await findAccountIdForCustomer(admin, organizationId, customerId);
  if (!accountId) {
    return googleAdsJson({ error: "Customer not linked to this organization" }, 400);
  }

  const resolved = await resolveOrgGoogleAdsForUpload(admin, organizationId, accountId, {
    requireUploadsEnabled: false,
  });
  if (!resolved) {
    return googleAdsJson({ error: "Connect Google Ads and add an account first" }, 400);
  }

  const runtimeConfig = { ...resolved.config, customerId };
  const { clause: dateClause, dateStart, dateEnd } = resolveDateRange(body.date_range);
  const statusFilter = body.status_filter === "enabled_only" ? "enabled_only" : "all";
  const onlyRunning = body.only_running !== false;
  const pageSize = Math.min(
    Math.max(Number(body.page_size) || DEFAULT_PAGE_SIZE, 1),
    100,
  );
  const pageToken = body.page_token != null ? String(body.page_token).trim() : "";
  const sortKey = parseSortKey(body.sort);
  const metricsKey = buildMetricsKey(metricDefs.map((d) => d.key));

  const now = new Date();
  const nowIso = now.toISOString();

  const { data: cacheRow } = await admin
    .from("google_ads_metrics_cache")
    .select("response_json, expires_at, fetched_at")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("entity", entity)
    .eq("date_start", dateStart)
    .eq("date_end", dateEnd)
    .eq("metrics_key", metricsKey)
    .eq("status_filter", statusFilter)
    .eq("only_running", onlyRunning)
    .eq("sort_key", sortKey)
    .eq("page_token", pageToken)
    .gt("expires_at", nowIso)
    .maybeSingle();

  let accessToken: string;
  try {
    accessToken = await fetchGoogleAdsAccessToken(runtimeConfig);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const msg = /invalid_grant|expired|revoked/i.test(raw)
      ? "Google Ads authorization expired or was revoked. Reconnect Google Ads in Omnichannel settings."
      : raw;
    return googleAdsJson({ error: msg, code: "TOKEN_REFRESH_FAILED" }, 401);
  }

  if (cacheRow?.response_json) {
    const cached = cacheRow.response_json as CachePayload;
    if (entity === "ad" && cached.rows.length > 0) {
      await enrichAdRowsWithPreviews(runtimeConfig, accessToken, customerId, cached.rows);
    }
    return googleAdsJson({
      ...cached,
      cached: true,
      fetched_at: cacheRow.fetched_at ?? cached.fetched_at,
    }, 200);
  }

  const queryOpts = {
    entity,
    metricDefs,
    dateClause,
    statusFilter,
    sortKey,
    pageSize,
  };

  let query = buildGaqlQuery(queryOpts);

  async function runGaql(q: string) {
    return gaqlSearchPage<Record<string, unknown>>(
      runtimeConfig,
      accessToken,
      customerId,
      q,
      pageToken,
    );
  }

  try {
    let page;
    try {
      page = await runGaql(query);
    } catch (firstErr) {
      const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      if (entity === "ad" && !queryOpts.adIdentityMinimal && isAdCreativeGaqlError(firstMsg)) {
        console.warn("google-ads-metrics: retrying ad query with minimal identity fields", firstMsg);
        query = buildGaqlQuery({ ...queryOpts, adIdentityMinimal: true });
        page = await runGaql(query);
      } else {
        throw firstErr;
      }
    }

    let currencyCode: string | null = null;
    const rows: ReturnType<typeof normalizeGaqlRow>[] = [];

    for (const raw of page.results) {
      const customer = raw.customer as Record<string, unknown> | undefined;
      if (!currencyCode && customer?.currencyCode != null) {
        currencyCode = String(customer.currencyCode);
      }
      if (!currencyCode && customer?.currency_code != null) {
        currencyCode = String(customer.currency_code);
      }

      const normalized = normalizeGaqlRow(entity, raw, metricDefs);
      if (rowPassesDeliveryFilter(normalized.metrics, onlyRunning)) {
        rows.push(normalized);
      }
    }

    if (entity === "ad" && rows.length > 0) {
      await enrichAdRowsWithPreviews(runtimeConfig, accessToken, customerId, rows);
    }

    const payload: CachePayload = {
      customer_id: customerId,
      currency_code: currencyCode,
      entity,
      date_range: { start: dateStart, end: dateEnd },
      rows,
      next_page_token: page.nextPageToken,
      fetched_at: nowIso,
    };

    const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: cacheErr } = await admin.from("google_ads_metrics_cache").upsert(
      {
        organization_id: organizationId,
        customer_id: customerId,
        entity,
        date_start: dateStart,
        date_end: dateEnd,
        metrics_key: metricsKey,
        status_filter: statusFilter,
        only_running: onlyRunning,
        page_token: pageToken,
        sort_key: sortKey,
        response_json: payload,
        fetched_at: nowIso,
        expires_at: expiresAt,
      },
      {
        onConflict:
          "organization_id,customer_id,entity,date_start,date_end,metrics_key,status_filter,only_running,page_token,sort_key",
        ignoreDuplicates: false,
      },
    );
    if (cacheErr) {
      console.error("google-ads-metrics cache upsert:", cacheErr.message);
    }

    return googleAdsJson({ ...payload, cached: false }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("google-ads-metrics fetchMetrics:", msg, "query:", query.slice(0, 500));
    const unsupported = parseUnsupportedMetricsFromError(msg);
    if (unsupported.length > 0) {
      return googleAdsJson({
        error: msg,
        unsupported_metrics: unsupported,
        code: "UNSUPPORTED_METRICS",
      }, 400);
    }
    if (/DEVELOPER_TOKEN_NOT_APPROVED/i.test(msg)) {
      return googleAdsJson({
        error: msg,
        code: "DEVELOPER_TOKEN_NOT_APPROVED",
      }, 403);
    }
    if (/invalid_grant|token|oauth|refresh/i.test(msg)) {
      return googleAdsJson({
        error: msg,
        code: "TOKEN_REFRESH_FAILED",
      }, 401);
    }
    return googleAdsJson({
      error: msg,
      code: "GOOGLE_ADS_API_ERROR",
    }, 400);
  }
});
