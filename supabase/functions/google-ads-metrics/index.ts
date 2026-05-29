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
import {
  gaqlSearchPage,
  isManagerCustomerAccount,
  listEnabledClientAccountsUnderManager,
  withManagerLogin,
  type GoogleAdsClientAccount,
} from "../_shared/googleAdsGaql.ts";
import {
  buildGaqlQuery,
  buildKeywordInventoryGaqlQuery,
  buildMetricsKey,
  computeSummaryTotals,
  ensureSortMetricDefs,
  ensureSummaryFetchMetricDefs,
  ensureSummaryMetricDefs,
  getMetricCatalogForApi,
  normalizeGaqlRow,
  paginateMetricsRows,
  sortNormalizedMetricsRows,
  isAdCreativeGaqlError,
  mergeKeywordInventoryWithMetrics,
  filterClientUnsupportedMetrics,
  mergeMetricsRowsByEntity,
  KEYWORD_VIEW_EXCLUDED_METRIC_KEYS,
  parseUnsupportedMetricsFromError,
  parseGoogleAdsResourceId,
  resolveMetrics,
  rowPassesDeliveryFilter,
  validateMetricsCount,
  type MetricEntity,
} from "../_shared/googleAdsMetricsCatalog.ts";
import { enrichAdRowsWithPreviews } from "../_shared/googleAdsAdPreview.ts";
import {
  buildListAdGroupsGaql,
  buildListCampaignsGaql,
  normalizeAdGroupListRow,
  normalizeCampaignListRow,
  parseCompositeResourceFilter,
  type GoogleAdsAdGroupListItem,
  type GoogleAdsCampaignListItem,
} from "../_shared/googleAdsFilterResources.ts";
import {
  buildConversionActionMetricsGaql,
  buildListCustomColumnsGaql,
  customKeysForCustomer,
  mergeConversionActionMetricsIntoRows,
  normalizeConversionActionSegmentRows,
  normalizeCustomColumnListRow,
  splitMetricKeys,
} from "../_shared/googleAdsCustomColumns.ts";
import {
  isUiCustomMetricKey,
  parseImportColumnNames,
  parseUiCustomMetricKey,
  rowToUiCustomColumnListItem,
  type UiCustomColumnListItem,
} from "../_shared/googleAdsUiCustomColumns.ts";
import { resolveOrgGoogleAdsForUpload } from "../_shared/googleAdsOrgResolver.ts";
import { fetchGoogleAdsAccessToken } from "../google-ads-upload-offline-conversion/googleAdsHelpers.ts";
import type { GoogleAdsConfig } from "../google-ads-upload-offline-conversion/googleAdsHelpers.ts";

const CACHE_TTL_MINUTES = 10;
const DEFAULT_PAGE_SIZE = 50;
/** Rows per GAQL request when building full reports (then merged per campaign/ad group). */
const GAQL_FETCH_PAGE_SIZE = 10_000;
const MAX_GAQL_PAGES = 50;

function parsePageOffset(raw: unknown): number {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return Math.max(0, Number(s));
  return 0;
}

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

/** Google Ads API caps each `segments.date` query to ~1095 days; stack windows for “all time”. */
const GAQL_MAX_DAYS_PER_WINDOW = 1095;
/** ~12 × 1095 days covers 30+ years of stacked GAQL windows for “all time”. */
const MAX_HISTORICAL_WINDOWS = 12;

export type DateRangeWindow = {
  clause: string;
  dateStart: string;
  dateEnd: string;
};

function parseYmdDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d);
}

function buildDateWindowsFromRange(startStr: string, endStr: string): DateRangeWindow[] {
  const windows: DateRangeWindow[] = [];
  let windowEnd = parseYmdDate(endStr);
  const earliest = parseYmdDate(startStr);

  for (let i = 0; i < MAX_HISTORICAL_WINDOWS; i++) {
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - (GAQL_MAX_DAYS_PER_WINDOW - 1));
    if (windowStart < earliest) {
      windowStart.setTime(earliest.getTime());
    }
    const winStartStr = formatDateYmd(windowStart);
    const winEndStr = formatDateYmd(windowEnd);
    windows.push({
      clause: `segments.date BETWEEN '${winStartStr}' AND '${winEndStr}'`,
      dateStart: winStartStr,
      dateEnd: winEndStr,
    });
    if (windowStart.getTime() <= earliest.getTime()) break;
    windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() - 1);
  }
  return windows;
}

function buildMaximumDateWindows(today: Date): DateRangeWindow[] {
  const startMax = new Date(today);
  startMax.setDate(startMax.getDate() - 1095);
  return buildDateWindowsFromRange(formatDateYmd(startMax), formatDateYmd(today));
}

function daysBetweenYmd(startStr: string, endStr: string): number {
  const start = parseYmdDate(startStr);
  const end = parseYmdDate(endStr);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

function resolveQueryWindows(
  startStr: string,
  endStr: string,
): DateRangeWindow[] | undefined {
  if (daysBetweenYmd(startStr, endStr) > GAQL_MAX_DAYS_PER_WINDOW) {
    return buildDateWindowsFromRange(startStr, endStr);
  }
  return undefined;
}

function resolveDateRange(
  dateRange: unknown,
): { clause: string; dateStart: string; dateEnd: string; windows?: DateRangeWindow[] } {
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
    if (preset === "LAST_7_DAYS" || preset === "LAST_30_DAYS") {
      const start = String(dr.start ?? "").trim();
      const end = String(dr.end ?? "").trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
        const windows = resolveQueryWindows(start, end);
        return {
          clause: `segments.date BETWEEN '${start}' AND '${end}'`,
          dateStart: start,
          dateEnd: end,
          windows,
        };
      }
      if (preset === "LAST_7_DAYS") {
        return {
          clause: "segments.date DURING LAST_7_DAYS",
          dateStart: defaultStart,
          dateEnd: defaultEnd,
        };
      }
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
      const windows = resolveQueryWindows(start, end);
      return {
        clause: `segments.date BETWEEN '${start}' AND '${end}'`,
        dateStart: start,
        dateEnd: end,
        windows,
      };
    }
    if (preset === "MAXIMUM" || preset === "ALL_TIME") {
      const windows =
        /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)
          ? buildDateWindowsFromRange(start, end)
          : buildMaximumDateWindows(today);
      const oldest = windows[windows.length - 1]!;
      const newest = windows[0]!;
      return {
        clause: newest.clause,
        dateStart: oldest.dateStart,
        dateEnd: newest.dateEnd,
        windows,
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
  if (e === "campaign" || e === "ad_group" || e === "ad" || e === "keyword") return e;
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
  total_row_count?: number;
  total_row_count_before_delivery?: number;
  summary_totals?: ReturnType<typeof computeSummaryTotals>;
  fetched_at: string;
  manager_aggregate?: boolean;
  queried_customer_ids?: string[];
};

type MetricsQueryTarget = {
  customerId: string;
  loginCustomerId: string | null;
  managerAggregate: boolean;
  clientAccounts: GoogleAdsClientAccount[];
};

async function resolveMetricsQueryTarget(
  runtimeConfig: GoogleAdsConfig,
  accessToken: string,
  requestedCustomerId: string,
): Promise<MetricsQueryTarget | { error: string; code: string; client_accounts?: GoogleAdsClientAccount[] }> {
  const isManager = await isManagerCustomerAccount(runtimeConfig, accessToken, requestedCustomerId);
  if (!isManager) {
    return {
      customerId: requestedCustomerId,
      loginCustomerId: runtimeConfig.loginCustomerId ?? null,
      managerAggregate: false,
      clientAccounts: [],
    };
  }

  const mccConfig = withManagerLogin(runtimeConfig, requestedCustomerId);
  const clients = await listEnabledClientAccountsUnderManager(
    mccConfig,
    accessToken,
    requestedCustomerId,
  );
  if (clients.length === 0) {
    return {
      error:
        "Akun ini adalah Manager (MCC) tanpa akun klien aktif. Tambahkan customer ID akun iklan (bukan MCC) di pengaturan Google Ads.",
      code: "MANAGER_ACCOUNT_NO_CLIENTS",
    };
  }
  if (clients.length === 1) {
    return {
      customerId: clients[0]!.customerId,
      loginCustomerId: requestedCustomerId,
      managerAggregate: false,
      clientAccounts: clients,
    };
  }

  return {
    customerId: requestedCustomerId,
    loginCustomerId: requestedCustomerId,
    managerAggregate: true,
    clientAccounts: clients,
  };
}

const LIST_GAQL_MAX_PAGES = 5;

async function fetchAllGaqlListRows(
  cfg: GoogleAdsConfig,
  accessToken: string,
  metricsCustomerId: string,
  query: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let token: string | null = null;
  for (let i = 0; i < LIST_GAQL_MAX_PAGES; i++) {
    const page = await gaqlSearchPage<Record<string, unknown>>(
      cfg,
      accessToken,
      metricsCustomerId,
      query,
      token ?? undefined,
    );
    rows.push(...page.results);
    token = page.nextPageToken;
    if (!token) break;
  }
  return rows;
}

async function resolveAccessForCustomer(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  customerId: string,
): Promise<
  | {
    runtimeConfig: GoogleAdsConfig;
    accessToken: string;
    queryTarget: MetricsQueryTarget;
  }
  | Response
> {
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
  const queryTarget = await resolveMetricsQueryTarget(runtimeConfig, accessToken, customerId);
  if ("error" in queryTarget) {
    return googleAdsJson(
      {
        error: queryTarget.error,
        code: queryTarget.code,
        client_accounts: queryTarget.client_accounts,
      },
      400,
    );
  }
  return { runtimeConfig, accessToken, queryTarget };
}

async function handleListCampaigns(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<Response> {
  const customerId = digitsOnly(String(body.customer_id ?? ""), 10);
  if (!customerId) {
    return googleAdsJson({ error: "customer_id required (10 digits)" }, 400);
  }
  const statusFilter: "all" | "enabled_only" =
    body.status_filter === "enabled_only" ? "enabled_only" : "all";
  const access = await resolveAccessForCustomer(admin, organizationId, customerId);
  if (access instanceof Response) return access;

  const { runtimeConfig, accessToken, queryTarget } = access;
  const query = buildListCampaignsGaql(statusFilter);
  const campaigns: GoogleAdsCampaignListItem[] = [];
  const seen = new Set<string>();

  const clients = queryTarget.managerAggregate
    ? queryTarget.clientAccounts
    : [{ customerId: queryTarget.customerId, descriptiveName: "" }];

  try {
    for (const client of clients) {
      const cfg: GoogleAdsConfig = {
        ...runtimeConfig,
        customerId: client.customerId,
        loginCustomerId: queryTarget.loginCustomerId ?? runtimeConfig.loginCustomerId,
      };
      const rawRows = await fetchAllGaqlListRows(
        cfg,
        accessToken,
        client.customerId,
        query,
      );
      const label = queryTarget.managerAggregate ? client.descriptiveName : undefined;
      for (const raw of rawRows) {
        const item = normalizeCampaignListRow(raw, client.customerId, label);
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        campaigns.push(item);
      }
    }
    campaigns.sort((a, b) => a.name.localeCompare(b.name));
    return googleAdsJson({ campaigns }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return googleAdsJson({ error: msg, code: "GOOGLE_ADS_API_ERROR" }, 400);
  }
}

async function handleListAdGroups(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<Response> {
  const customerId = digitsOnly(String(body.customer_id ?? ""), 10);
  if (!customerId) {
    return googleAdsJson({ error: "customer_id required (10 digits)" }, 400);
  }
  const campaignFilter = parseCompositeResourceFilter(String(body.campaign_id ?? ""));
  if (!campaignFilter.resourceId) {
    return googleAdsJson({ error: "campaign_id required" }, 400);
  }
  const statusFilter: "all" | "enabled_only" =
    body.status_filter === "enabled_only" ? "enabled_only" : "all";
  const access = await resolveAccessForCustomer(admin, organizationId, customerId);
  if (access instanceof Response) return access;

  const { runtimeConfig, accessToken, queryTarget } = access;
  const metricsCustomerId = campaignFilter.metricsCustomerId;
  const adGroups: GoogleAdsAdGroupListItem[] = [];
  const seen = new Set<string>();

  try {
    if (metricsCustomerId) {
      const cfg: GoogleAdsConfig = {
        ...runtimeConfig,
        customerId: metricsCustomerId,
        loginCustomerId: queryTarget.loginCustomerId ?? runtimeConfig.loginCustomerId,
      };
      const query = buildListAdGroupsGaql(campaignFilter.resourceId, statusFilter);
      const rawRows = await fetchAllGaqlListRows(cfg, accessToken, metricsCustomerId, query);
      for (const raw of rawRows) {
        const item = normalizeAdGroupListRow(raw, metricsCustomerId);
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        adGroups.push(item);
      }
    } else if (queryTarget.managerAggregate) {
      for (const client of queryTarget.clientAccounts) {
        const cfg: GoogleAdsConfig = {
          ...runtimeConfig,
          customerId: client.customerId,
          loginCustomerId: queryTarget.loginCustomerId ?? runtimeConfig.loginCustomerId,
        };
        const query = buildListAdGroupsGaql(campaignFilter.resourceId, statusFilter);
        const rawRows = await fetchAllGaqlListRows(cfg, accessToken, client.customerId, query);
        for (const raw of rawRows) {
          const item = normalizeAdGroupListRow(raw, client.customerId);
          if (!item || seen.has(item.id)) continue;
          seen.add(item.id);
          adGroups.push(item);
        }
      }
    } else {
      const cfg: GoogleAdsConfig = {
        ...runtimeConfig,
        customerId: queryTarget.customerId,
        loginCustomerId: queryTarget.loginCustomerId ?? runtimeConfig.loginCustomerId,
      };
      const query = buildListAdGroupsGaql(campaignFilter.resourceId, statusFilter);
      const rawRows = await fetchAllGaqlListRows(
        cfg,
        accessToken,
        queryTarget.customerId,
        query,
      );
      for (const raw of rawRows) {
        const item = normalizeAdGroupListRow(raw, queryTarget.customerId);
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        adGroups.push(item);
      }
    }
    adGroups.sort((a, b) => a.name.localeCompare(b.name));
    return googleAdsJson({ ad_groups: adGroups }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return googleAdsJson({ error: msg, code: "GOOGLE_ADS_API_ERROR" }, 400);
  }
}

async function handleListUiCustomColumns(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<Response> {
  const customerId = digitsOnly(String(body.customer_id ?? ""), 10);
  const entity = parseEntity(body.entity);
  if (!customerId) {
    return googleAdsJson({ error: "customer_id required (10 digits)" }, 400);
  }
  if (!entity) {
    return googleAdsJson({ error: "entity must be campaign, ad_group, ad, or keyword" }, 400);
  }

  const { data, error } = await admin
    .from("organization_google_ads_ui_custom_columns")
    .select("id, name, formula_text, sort_order")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("entity", entity)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return googleAdsJson({ error: error.message }, 500);

  const custom_columns: UiCustomColumnListItem[] = (data ?? []).map((row) =>
    rowToUiCustomColumnListItem({
      id: String(row.id),
      name: String(row.name),
      formula_text: row.formula_text != null ? String(row.formula_text) : null,
      sort_order: Number(row.sort_order) || 0,
    }),
  );

  return googleAdsJson({ custom_columns }, 200);
}

async function handleImportUiCustomColumns(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<Response> {
  const customerId = digitsOnly(String(body.customer_id ?? ""), 10);
  const entity = parseEntity(body.entity);
  if (!customerId) {
    return googleAdsJson({ error: "customer_id required (10 digits)" }, 400);
  }
  if (!entity) {
    return googleAdsJson({ error: "entity must be campaign, ad_group, ad, or keyword" }, 400);
  }

  const names = parseImportColumnNames(body.names ?? body.lines ?? body.text);
  if (names.length === 0) {
    return googleAdsJson({ error: "At least one column name is required" }, 400);
  }
  if (names.length > 200) {
    return googleAdsJson({ error: "Maximum 200 column names per import" }, 400);
  }

  const replaceAll = body.replace_all === true;

  if (replaceAll) {
    const { error: delErr } = await admin
      .from("organization_google_ads_ui_custom_columns")
      .delete()
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("entity", entity);
    if (delErr) return googleAdsJson({ error: delErr.message }, 500);
  }

  const rows = names.map((name, index) => ({
    organization_id: organizationId,
    customer_id: customerId,
    entity,
    name,
    sort_order: index,
    updated_at: new Date().toISOString(),
  }));

  const { data: upserted, error: upsertErr } = await admin
    .from("organization_google_ads_ui_custom_columns")
    .upsert(rows, { onConflict: "organization_id,customer_id,entity,name" })
    .select("id, name, formula_text, sort_order");

  if (upsertErr) return googleAdsJson({ error: upsertErr.message }, 500);

  const custom_columns: UiCustomColumnListItem[] = (upserted ?? [])
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    .map((row) =>
      rowToUiCustomColumnListItem({
        id: String(row.id),
        name: String(row.name),
        formula_text: row.formula_text != null ? String(row.formula_text) : null,
        sort_order: Number(row.sort_order) || 0,
      }),
    );

  return googleAdsJson({ custom_columns, imported_count: names.length }, 200);
}

async function handleDeleteUiCustomColumn(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<Response> {
  const id = String(body.id ?? "").trim();
  const columnId = parseUiCustomMetricKey(body.key != null ? String(body.key) : "") ?? id;
  if (!columnId || !/^[0-9a-f-]{36}$/i.test(columnId)) {
    return googleAdsJson({ error: "id or ui_custom key required" }, 400);
  }

  const { error } = await admin
    .from("organization_google_ads_ui_custom_columns")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", columnId);

  if (error) return googleAdsJson({ error: error.message }, 500);
  return googleAdsJson({ ok: true }, 200);
}

async function handleListCustomColumns(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<Response> {
  const customerId = digitsOnly(String(body.customer_id ?? ""), 10);
  if (!customerId) {
    return googleAdsJson({ error: "customer_id required (10 digits)" }, 400);
  }
  const access = await resolveAccessForCustomer(admin, organizationId, customerId);
  if (access instanceof Response) return access;

  const { runtimeConfig, accessToken, queryTarget } = access;
  const query = buildListCustomColumnsGaql();
  const custom_columns: ReturnType<typeof normalizeCustomColumnListRow>[] = [];
  const seen = new Set<string>();

  const clients = queryTarget.managerAggregate
    ? queryTarget.clientAccounts
    : [{ customerId: queryTarget.customerId, descriptiveName: "" }];

  try {
    for (const client of clients) {
      const cfg: GoogleAdsConfig = {
        ...runtimeConfig,
        customerId: client.customerId,
        loginCustomerId: queryTarget.loginCustomerId ?? runtimeConfig.loginCustomerId,
      };
      const rawRows = await fetchAllGaqlListRows(cfg, accessToken, client.customerId, query);
      const label = queryTarget.managerAggregate ? client.descriptiveName : undefined;
      for (const raw of rawRows) {
        const item = normalizeCustomColumnListRow(raw, client.customerId, label);
        if (!item || seen.has(item.key)) continue;
        seen.add(item.key);
        custom_columns.push(item);
      }
    }
    custom_columns.sort((a, b) => a.label.localeCompare(b.label));
    return googleAdsJson({ custom_columns }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return googleAdsJson({ error: msg, code: "GOOGLE_ADS_API_ERROR" }, 400);
  }
}

async function handleGetAccountDateBounds(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<Response> {
  const customerId = digitsOnly(String(body.customer_id ?? ""), 10);
  if (!customerId) {
    return googleAdsJson({ error: "Missing customer_id" }, 400);
  }

  const accountId = await findAccountIdForCustomer(admin, organizationId, customerId);
  const resolved = await resolveOrgGoogleAdsForUpload(admin, organizationId, accountId, {
    requireUploadsEnabled: false,
  });
  if (!resolved) {
    return googleAdsJson({ error: "Connect Google Ads and add an account first" }, 400);
  }

  const runtimeConfig = { ...resolved.config, customerId };
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

  const queryTarget = await resolveMetricsQueryTarget(runtimeConfig, accessToken, customerId);
  if ("error" in queryTarget) {
    return googleAdsJson(
      { error: queryTarget.error, code: queryTarget.code, client_accounts: queryTarget.client_accounts },
      400,
    );
  }

  const metricsCustomerId = queryTarget.managerAggregate
    ? queryTarget.clientAccounts[0]?.customerId ?? customerId
    : queryTarget.customerId;

  const cfg: GoogleAdsConfig = {
    ...runtimeConfig,
    customerId: metricsCustomerId,
    loginCustomerId: queryTarget.loginCustomerId ?? runtimeConfig.loginCustomerId,
  };

  const today = formatDateYmd(new Date());
  const earliestQuery =
    `SELECT segments.date FROM campaign WHERE segments.date BETWEEN '2010-01-01' AND '${today}' AND metrics.impressions > 0 ORDER BY segments.date ASC LIMIT 1`;

  try {
    const page = await gaqlSearchPage<Record<string, unknown>>(
      cfg,
      accessToken,
      metricsCustomerId,
      earliestQuery,
    );
    let earliest = "2010-01-01";
    for (const row of page.results) {
      const seg = row.segments as Record<string, unknown> | undefined;
      if (seg?.date != null) {
        earliest = String(seg.date);
        break;
      }
    }
    return googleAdsJson({ earliest_date: earliest, latest_date: today }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("google-ads-metrics getAccountDateBounds:", msg);
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() - 4);
    return googleAdsJson({
      earliest_date: formatDateYmd(fallback),
      latest_date: today,
    }, 200);
  }
}

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

  if (action === "listCustomColumns") {
    return await handleListCustomColumns(admin, body, organizationId);
  }

  if (action === "listUiCustomColumns") {
    return await handleListUiCustomColumns(admin, body, organizationId);
  }

  if (action === "importUiCustomColumns") {
    return await handleImportUiCustomColumns(admin, body, organizationId);
  }

  if (action === "deleteUiCustomColumn") {
    return await handleDeleteUiCustomColumn(admin, body, organizationId);
  }

  if (action === "listColumnSets") {
    const entity = parseEntity(body.entity);
    if (!entity) {
      return googleAdsJson({ error: "entity must be campaign, ad_group, ad, or keyword" }, 400);
    }
    const { data, error } = await admin
      .from("organization_google_ads_column_sets")
      .select("id, name, metric_keys, created_at, updated_at")
      .eq("organization_id", organizationId)
      .eq("user_id", userRes.userId)
      .eq("entity", entity)
      .order("name", { ascending: true });
    if (error) return googleAdsJson({ error: error.message }, 500);
    const column_sets = (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      metric_keys: Array.isArray(row.metric_keys)
        ? (row.metric_keys as unknown[]).map((k) => String(k)).filter(Boolean)
        : [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    return googleAdsJson({ column_sets }, 200);
  }

  if (action === "saveColumnSet") {
    const entity = parseEntity(body.entity);
    if (!entity) {
      return googleAdsJson({ error: "entity must be campaign, ad_group, ad, or keyword" }, 400);
    }
    const name = String(body.name ?? "").trim();
    if (!name) return googleAdsJson({ error: "name is required" }, 400);
    if (name.length > 120) {
      return googleAdsJson({ error: "name must be at most 120 characters" }, 400);
    }
    const keysRaw = Array.isArray(body.metric_keys)
      ? (body.metric_keys as unknown[])
      : Array.isArray(body.metrics)
        ? (body.metrics as unknown[])
        : [];
    const metricKeys = keysRaw.map((k) => String(k).trim()).filter(Boolean);
    const countErr = validateMetricsCount(metricKeys);
    if (countErr) return googleAdsJson({ error: countErr }, 400);
    const { catalogKeys, customKeys, uiCustomKeys } = splitMetricKeys(metricKeys);
    const { defs, invalid } = resolveMetrics(catalogKeys, entity);
    if (invalid.length > 0) {
      return googleAdsJson(
        { error: `Invalid metrics for ${entity}: ${invalid.join(", ")}` },
        400,
      );
    }
    if (defs.length === 0 && customKeys.length === 0 && uiCustomKeys.length === 0) {
      return googleAdsJson({ error: "At least one metric is required" }, 400);
    }
    const allowed = new Set([...defs.map((d) => d.key), ...customKeys, ...uiCustomKeys]);
    const seen = new Set<string>();
    const orderedKeys: string[] = [];
    for (const key of metricKeys) {
      if (!allowed.has(key) || seen.has(key)) continue;
      seen.add(key);
      orderedKeys.push(key);
    }
    const { data: saved, error: saveErr } = await admin
      .from("organization_google_ads_column_sets")
      .upsert(
        {
          organization_id: organizationId,
          user_id: userRes.userId,
          entity,
          name,
          metric_keys: orderedKeys,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id,entity,name" },
      )
      .select("id, name, metric_keys, created_at, updated_at")
      .single();
    if (saveErr) return googleAdsJson({ error: saveErr.message }, 500);
    return googleAdsJson(
      {
        column_set: {
          id: String(saved.id),
          name: String(saved.name),
          metric_keys: orderedKeys,
          created_at: saved.created_at,
          updated_at: saved.updated_at,
        },
      },
      200,
    );
  }

  if (action === "deleteColumnSet") {
    const entity = parseEntity(body.entity);
    if (!entity) {
      return googleAdsJson({ error: "entity must be campaign, ad_group, ad, or keyword" }, 400);
    }
    const id = String(body.id ?? "").trim();
    const name = String(body.name ?? "").trim();
    if (!id && !name) {
      return googleAdsJson({ error: "id or name is required" }, 400);
    }
    let del = admin
      .from("organization_google_ads_column_sets")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", userRes.userId)
      .eq("entity", entity);
    if (id) del = del.eq("id", id);
    else del = del.eq("name", name);
    const { error: delErr } = await del;
    if (delErr) return googleAdsJson({ error: delErr.message }, 500);
    return googleAdsJson({ ok: true }, 200);
  }

  if (action === "getAccountDateBounds") {
    return await handleGetAccountDateBounds(admin, body, organizationId);
  }

  if (action === "listCampaigns") {
    return await handleListCampaigns(admin, body, organizationId);
  }

  if (action === "listAdGroups") {
    return await handleListAdGroups(admin, body, organizationId);
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
    return googleAdsJson(
      { error: "entity must be campaign, ad_group, ad, or keyword" },
      400,
    );
  }

  const metricKeysRaw = Array.isArray(body.metrics)
    ? (body.metrics as unknown[]).map((k) => String(k))
    : [];
  const countErr = validateMetricsCount(metricKeysRaw);
  if (countErr) return googleAdsJson({ error: countErr }, 400);

  const { catalogKeys, customKeys, uiCustomKeys } = splitMetricKeys(metricKeysRaw);
  const { defs: metricDefs, invalid } =
    catalogKeys.length > 0 || (customKeys.length === 0 && uiCustomKeys.length === 0)
      ? resolveMetrics(catalogKeys.length > 0 ? catalogKeys : [], entity)
      : { defs: [], invalid: [] as string[] };
  if (uiCustomKeys.some((k) => !isUiCustomMetricKey(k))) {
    console.warn("google-ads-metrics: ignored invalid ui_custom keys", uiCustomKeys);
  }
  const sortKey = parseSortKey(body.sort);
  const summaryMetricsRaw = Array.isArray(body.summary_metrics)
    ? (body.summary_metrics as unknown[]).map((k) => String(k).trim()).filter(Boolean)
    : [];
  const summaryPrimaryFallback =
    String(body.summary_primary_metric ?? "spent").trim() || "spent";
  const summaryMetrics =
    summaryMetricsRaw.length > 0 ? [...new Set(summaryMetricsRaw)] : [summaryPrimaryFallback];
  const { catalogKeys: summaryCatalogKeys, customKeys: summaryConvKeys } =
    splitMetricKeys(summaryMetrics);
  let activeMetricDefs = ensureSummaryFetchMetricDefs(
    ensureSortMetricDefs([...metricDefs], sortKey, entity),
    entity,
    summaryCatalogKeys,
  );
  const summaryConvForFetch = [
    ...new Set([
      ...customKeys,
      ...summaryConvKeys.filter((k) => !customKeys.includes(k)),
    ]),
  ];
  const summaryCacheToken = `summary:${[...summaryMetrics].sort().join(",")}`;
  /** API retry drops only; entity-invalid keys are not surfaced to the client banner. */
  const apiOmittedMetricKeys: string[] = [];
  const recordApiOmitted = (keys: string[]) => {
    for (const k of keys) {
      if (entity === "keyword" && KEYWORD_VIEW_EXCLUDED_METRIC_KEYS.has(k)) continue;
      if (!apiOmittedMetricKeys.includes(k)) apiOmittedMetricKeys.push(k);
    }
  };
  const clientUnsupportedMetrics = () =>
    filterClientUnsupportedMetrics(entity, apiOmittedMetricKeys);
  if (invalid.length > 0) {
    console.warn("google-ads-metrics: ignored metrics for entity", entity, invalid);
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
  const { clause: dateClause, dateStart, dateEnd, windows: dateWindows } = resolveDateRange(
    body.date_range,
  );
  const queryDateWindows: DateRangeWindow[] =
    dateWindows && dateWindows.length > 0
      ? dateWindows
      : [{ clause: dateClause, dateStart, dateEnd }];
  const statusFilter: "all" | "enabled_only" =
    body.status_filter === "enabled_only" ? "enabled_only" : "all";
  const onlyRunning = body.only_running !== false;
  const pageSize = Math.min(
    Math.max(Number(body.page_size) || DEFAULT_PAGE_SIZE, 1),
    100,
  );
  const pageOffset = parsePageOffset(body.page_offset ?? body.page_token);
  const campaignFilterRaw = String(body.campaign_filter_id ?? "").trim();
  const adGroupFilterRaw = String(body.ad_group_filter_id ?? "").trim();
  const campaignFilter = parseCompositeResourceFilter(campaignFilterRaw);
  const adGroupFilter = parseCompositeResourceFilter(adGroupFilterRaw);
  const now = new Date();
  const nowIso = now.toISOString();
  const forceRefresh = body.force_refresh === true;

  const metricsKeySuffix = [
    ...(campaignFilterRaw ? [`campaign:${campaignFilterRaw}`] : []),
    ...(adGroupFilterRaw ? [`ad_group:${adGroupFilterRaw}`] : []),
    ...(queryDateWindows.length > 1 ? ["historical_windows_v3"] : []),
    "pagination_total_v1",
    "delivery_count_v1",
    "gaql_metric_retry_v5",
    "date_range_between_v1",
    ...(entity === "keyword" ? ["keyword_inventory_v6"] : []),
    "no_billing_v2",
  ];

  if (forceRefresh) {
    const refreshMetricsKey = buildMetricsKey([
      ...metricDefs.map((d) => d.key),
      ...summaryConvForFetch,
      ...uiCustomKeys,
      summaryCacheToken,
      ...metricsKeySuffix,
    ]);
    const { error: delErr } = await admin
      .from("google_ads_metrics_cache")
      .delete()
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("entity", entity)
      .eq("date_start", dateStart)
      .eq("date_end", dateEnd)
      .eq("metrics_key", refreshMetricsKey)
      .eq("status_filter", statusFilter)
      .eq("only_running", onlyRunning)
      .eq("sort_key", sortKey);
    if (delErr) {
      console.warn("google-ads-metrics cache delete on refresh:", delErr.message);
    }
  }

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

  const queryTarget = await resolveMetricsQueryTarget(runtimeConfig, accessToken, customerId);
  if ("error" in queryTarget) {
    return googleAdsJson(
      {
        error: queryTarget.error,
        code: queryTarget.code,
        client_accounts: queryTarget.client_accounts,
      },
      400,
    );
  }

  const queryRuntimeConfig: GoogleAdsConfig = {
    ...runtimeConfig,
    customerId: queryTarget.customerId,
    loginCustomerId: queryTarget.loginCustomerId ?? runtimeConfig.loginCustomerId,
  };

  const scopedMetricsCustomerId =
    campaignFilter.metricsCustomerId ?? adGroupFilter.metricsCustomerId ?? null;

  gaqlMetricsLoop: for (let gaqlAttempt = 0; gaqlAttempt < 16; gaqlAttempt++) {
    const metricsKey = buildMetricsKey([
      ...activeMetricDefs.map((d) => d.key),
      ...summaryConvForFetch,
      ...uiCustomKeys,
      summaryCacheToken,
      ...metricsKeySuffix,
    ]);

    let cacheRow: { response_json?: unknown; expires_at?: string; fetched_at?: string } | null =
      null;
    if (!forceRefresh) {
      const { data } = await admin
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
        .eq("page_token", "")
        .gt("expires_at", nowIso)
        .maybeSingle();
      cacheRow = data;
    }

    if (cacheRow?.response_json) {
      const cached = cacheRow.response_json as CachePayload & {
        all_rows?: ReturnType<typeof normalizeGaqlRow>[];
      };
      const allRows = sortNormalizedMetricsRows(
        cached.all_rows ?? cached.rows,
        sortKey,
        entity,
      );
      const cachedTotal =
        typeof cached.total_row_count === "number" && Number.isFinite(cached.total_row_count)
          ? cached.total_row_count
          : 0;
      const { pageRows, totalRowCount: sortedTotal, nextOffset } = paginateMetricsRows(
        allRows,
        pageOffset,
        pageSize,
      );
      const totalRowCount = Math.max(sortedTotal, cachedTotal);
      const previewCustomerId = queryTarget.managerAggregate
        ? queryTarget.clientAccounts[0]?.customerId ?? customerId
        : queryTarget.customerId;
      if (entity === "ad" && pageRows.length > 0) {
        await enrichAdRowsWithPreviews(queryRuntimeConfig, accessToken, previewCustomerId, pageRows);
      }
      const cachedUnsupported = filterClientUnsupportedMetrics(
        entity,
        (cached as { unsupported_metrics?: string[] }).unsupported_metrics ?? [],
      );
      return googleAdsJson({
        ...cached,
        rows: pageRows,
        all_rows: undefined,
        summary_totals: computeSummaryTotals(allRows),
        next_page_token: nextOffset != null ? String(nextOffset) : null,
        total_row_count: totalRowCount,
        total_row_count_before_delivery: cached.total_row_count_before_delivery,
        ...(cachedUnsupported.length > 0 ? { unsupported_metrics: cachedUnsupported } : {}),
        cached: true,
        fetched_at: cacheRow.fetched_at ?? cached.fetched_at,
      }, 200);
    }

    const segmentByDate = queryDateWindows.length > 1;
    type MetricsGaqlQueryOpts = Parameters<typeof buildGaqlQuery>[0];
    const baseQueryOpts: MetricsGaqlQueryOpts = {
      entity,
      metricDefs: activeMetricDefs,
      dateClause,
      statusFilter,
      sortKey,
      pageSize: GAQL_FETCH_PAGE_SIZE,
      segmentByDate,
      campaignFilterId: campaignFilter.resourceId || undefined,
      adGroupFilterId: adGroupFilter.resourceId || undefined,
    };

    let query = buildGaqlQuery(baseQueryOpts);

  async function runGaqlForCustomer(
    cfg: GoogleAdsConfig,
    metricsCustomerId: string,
    q: string,
    gaqlPageToken?: string | null,
  ) {
    return gaqlSearchPage<Record<string, unknown>>(
      cfg,
      accessToken,
      metricsCustomerId,
      q,
      gaqlPageToken ?? undefined,
    );
  }

  async function fetchGaqlRawRowsForWindow(
    cfg: GoogleAdsConfig,
    metricsCustomerId: string,
    windowClause: string,
    clientLabel?: string,
  ): Promise<{
    rawRows: ReturnType<typeof normalizeGaqlRow>[];
    currencyCode: string | null;
  }> {
    const windowOpts: MetricsGaqlQueryOpts = { ...baseQueryOpts, dateClause: windowClause };
    let q = buildGaqlQuery(windowOpts);
    let currencyCode: string | null = null;
    const rawRows: ReturnType<typeof normalizeGaqlRow>[] = [];
    let gaqlToken: string | null = null;

    for (let pageIndex = 0; pageIndex < MAX_GAQL_PAGES; pageIndex++) {
      let page;
      try {
        page = await runGaqlForCustomer(cfg, metricsCustomerId, q, gaqlToken);
      } catch (firstErr) {
        const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        if (entity === "ad" && !windowOpts.adIdentityMinimal && isAdCreativeGaqlError(firstMsg)) {
          console.warn("google-ads-metrics: retrying ad query with minimal identity fields", firstMsg);
          q = buildGaqlQuery({ ...windowOpts, adIdentityMinimal: true });
          page = await runGaqlForCustomer(cfg, metricsCustomerId, q, gaqlToken);
        } else {
          throw firstErr;
        }
      }

      for (const raw of page.results) {
        const customer = raw.customer as Record<string, unknown> | undefined;
        if (!currencyCode && customer?.currencyCode != null) {
          currencyCode = String(customer.currencyCode);
        }
        if (!currencyCode && customer?.currency_code != null) {
          currencyCode = String(customer.currency_code);
        }

        const normalized = normalizeGaqlRow(entity, raw, activeMetricDefs);
        if (clientLabel) {
          const resourceId = normalized.id;
          normalized.identity.client_account = clientLabel;
          if (entity === "campaign") {
            normalized.identity.campaign_id = resourceId;
          }
          normalized.id = `${metricsCustomerId}-${resourceId}`;
        }
        rawRows.push(normalized);
      }

      gaqlToken = page.nextPageToken;
      if (!gaqlToken) break;
    }

    return { rawRows, currencyCode };
  }

  async function fetchKeywordInventoryRows(
    cfg: GoogleAdsConfig,
    metricsCustomerId: string,
    clientLabel?: string,
  ): Promise<ReturnType<typeof normalizeGaqlRow>[]> {
    const q = buildKeywordInventoryGaqlQuery({
      statusFilter,
      campaignFilterId: campaignFilter.resourceId || undefined,
      adGroupFilterId: adGroupFilter.resourceId || undefined,
      pageSize: GAQL_FETCH_PAGE_SIZE,
    });
    const inventoryRows: ReturnType<typeof normalizeGaqlRow>[] = [];
    let gaqlToken: string | null = null;

    for (let pageIndex = 0; pageIndex < MAX_GAQL_PAGES; pageIndex++) {
      const page = await runGaqlForCustomer(cfg, metricsCustomerId, q, gaqlToken);
      for (const raw of page.results) {
        const normalized = normalizeGaqlRow("keyword", raw, activeMetricDefs);
        if (clientLabel) {
          const resourceId = String(normalized.identity.criterion_id ?? normalized.id);
          normalized.identity.client_account = clientLabel;
          normalized.id = `${metricsCustomerId}-${resourceId}`;
        }
        inventoryRows.push(normalized);
      }
      gaqlToken = page.nextPageToken;
      if (!gaqlToken) break;
    }

    return inventoryRows;
  }

  async function fetchAllNormalizedForCustomer(
    cfg: GoogleAdsConfig,
    metricsCustomerId: string,
    clientLabel?: string,
  ): Promise<{
    rows: ReturnType<typeof normalizeGaqlRow>[];
    currencyCode: string | null;
    totalBeforeDelivery: number;
  }> {
    let currencyCode: string | null = null;
    const rawRows: ReturnType<typeof normalizeGaqlRow>[] = [];

    for (const w of queryDateWindows) {
      const part = await fetchGaqlRawRowsForWindow(
        cfg,
        metricsCustomerId,
        w.clause,
        clientLabel,
      );
      if (!currencyCode && part.currencyCode) currencyCode = part.currencyCode;
      rawRows.push(...part.rawRows);
    }

    let merged = mergeMetricsRowsByEntity(entity, rawRows);

    const keysForClient = customKeysForCustomer(summaryConvForFetch, metricsCustomerId);
    if (keysForClient.length > 0) {
      const segmentRaw: Record<string, unknown>[] = [];
      for (const w of queryDateWindows) {
        const convQuery = buildConversionActionMetricsGaql({
          entity,
          dateClause: w.clause,
          statusFilter,
          segmentByDate: queryDateWindows.length > 1,
          campaignFilterId: campaignFilter.resourceId || undefined,
          adGroupFilterId: adGroupFilter.resourceId || undefined,
        });
        let convToken: string | null = null;
        for (let pageIndex = 0; pageIndex < MAX_GAQL_PAGES; pageIndex++) {
          const page = await runGaqlForCustomer(cfg, metricsCustomerId, convQuery, convToken);
          segmentRaw.push(...page.results);
          convToken = page.nextPageToken;
          if (!convToken) break;
        }
      }
      const segmentNorm = normalizeConversionActionSegmentRows(
        entity,
        segmentRaw,
        metricsCustomerId,
        clientLabel,
      );
      merged = mergeConversionActionMetricsIntoRows(
        entity,
        merged,
        segmentNorm,
        keysForClient,
        metricsCustomerId,
        clientLabel,
      );
    }

    if (entity === "keyword" && !onlyRunning) {
      const inventory = mergeMetricsRowsByEntity(
        "keyword",
        await fetchKeywordInventoryRows(cfg, metricsCustomerId, clientLabel),
      );
      merged = mergeKeywordInventoryWithMetrics(inventory, merged, activeMetricDefs);
    }

    const totalBeforeDelivery = merged.length;
    merged = merged.filter((r) => rowPassesDeliveryFilter(r.metrics, onlyRunning));
    merged = sortNormalizedMetricsRows(merged, sortKey, entity);

    if (entity === "ad" && merged.length > 0) {
      await enrichAdRowsWithPreviews(cfg, accessToken, metricsCustomerId, merged);
    }

    return { rows: merged, currencyCode, totalBeforeDelivery };
  }

  try {
    let currencyCode: string | null = null;
    let allRows: ReturnType<typeof normalizeGaqlRow>[] = [];
    let totalBeforeDeliveryAll = 0;

    if (queryTarget.managerAggregate) {
      const clientsToQuery = scopedMetricsCustomerId
        ? queryTarget.clientAccounts.filter((c) => c.customerId === scopedMetricsCustomerId)
        : queryTarget.clientAccounts;
      let hiddenByDelivery = 0;
      for (const client of clientsToQuery) {
        const cfg: GoogleAdsConfig = {
          ...queryRuntimeConfig,
          customerId: client.customerId,
          loginCustomerId: queryTarget.loginCustomerId ?? queryRuntimeConfig.loginCustomerId,
        };
        const part = await fetchAllNormalizedForCustomer(cfg, client.customerId, client.descriptiveName);
        if (!currencyCode && part.currencyCode) currencyCode = part.currencyCode;
        hiddenByDelivery += part.totalBeforeDelivery - part.rows.length;
        allRows.push(...part.rows);
      }
      if (entity === "keyword") {
        allRows = mergeMetricsRowsByEntity("keyword", allRows);
      }
      allRows = sortNormalizedMetricsRows(allRows, sortKey, entity);
      totalBeforeDeliveryAll = allRows.length + hiddenByDelivery;
    } else {
      const part = await fetchAllNormalizedForCustomer(queryRuntimeConfig, queryTarget.customerId);
      currencyCode = part.currencyCode;
      allRows = part.rows;
      totalBeforeDeliveryAll = part.totalBeforeDelivery;
    }

    const { pageRows, totalRowCount: sortedTotal, nextOffset } = paginateMetricsRows(
      allRows,
      pageOffset,
      pageSize,
    );

    const summaryTotals = computeSummaryTotals(allRows);

    const payload: CachePayload & { all_rows: ReturnType<typeof normalizeGaqlRow>[] } = {
      customer_id: customerId,
      currency_code: currencyCode,
      entity,
      date_range: { start: dateStart, end: dateEnd },
      rows: pageRows,
      all_rows: allRows,
      summary_totals: summaryTotals,
      next_page_token: nextOffset != null ? String(nextOffset) : null,
      total_row_count: sortedTotal,
      total_row_count_before_delivery:
        onlyRunning && totalBeforeDeliveryAll > allRows.length ? totalBeforeDeliveryAll : undefined,
      fetched_at: nowIso,
      ...(campaignFilterRaw ? { campaign_filter_id: campaignFilterRaw } : {}),
      ...(adGroupFilterRaw ? { ad_group_filter_id: adGroupFilterRaw } : {}),
      ...(queryTarget.managerAggregate
        ? {
          manager_aggregate: true,
          queried_customer_ids: queryTarget.clientAccounts.map((c) => c.customerId),
        }
        : {}),
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
        page_token: "",
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

    const { all_rows: _all, ...clientPayload } = payload;
    return googleAdsJson({
      ...clientPayload,
      total_row_count: sortedTotal,
      total_row_count_before_delivery: payload.total_row_count_before_delivery,
      ...(clientUnsupportedMetrics().length > 0
        ? { unsupported_metrics: clientUnsupportedMetrics() }
        : {}),
      cached: false,
    }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("google-ads-metrics fetchMetrics:", msg, "query:", query.slice(0, 500));

    const unsupported = parseUnsupportedMetricsFromError(msg);
    const dropKeys = unsupported.filter((k) => activeMetricDefs.some((d) => d.key === k));
    if (dropKeys.length > 0 && activeMetricDefs.length > dropKeys.length) {
      recordApiOmitted(dropKeys);
      activeMetricDefs = activeMetricDefs.filter((d) => !dropKeys.includes(d.key));
      console.warn(
        "google-ads-metrics: retrying without unsupported metrics:",
        dropKeys.join(", "),
      );
      continue gaqlMetricsLoop;
    }

    if (/REQUESTED_METRICS_FOR_MANAGER/i.test(msg)) {
      try {
        const retryTarget = await resolveMetricsQueryTarget(runtimeConfig, accessToken, customerId);
        if (!("error" in retryTarget) && !retryTarget.managerAggregate) {
          const part = await fetchAllNormalizedForCustomer(
            {
              ...runtimeConfig,
              customerId: retryTarget.customerId,
              loginCustomerId: retryTarget.loginCustomerId ?? runtimeConfig.loginCustomerId,
            },
            retryTarget.customerId,
          );
          const pageRows = part.rows.slice(pageOffset, pageOffset + pageSize);
          const nextOffset = pageOffset + pageSize < part.rows.length ? pageOffset + pageSize : null;
          const payload: CachePayload = {
            customer_id: customerId,
            currency_code: part.currencyCode,
            entity,
            date_range: { start: dateStart, end: dateEnd },
            rows: pageRows,
            next_page_token: nextOffset != null ? String(nextOffset) : null,
            total_row_count: part.rows.length,
            summary_totals: computeSummaryTotals(part.rows),
            fetched_at: nowIso,
          };
          return googleAdsJson({ ...payload, cached: false }, 200);
        }
      } catch {
        // fall through to generic error
      }
      return googleAdsJson({
        error:
          "Customer ID yang dipilih adalah akun Manager (MCC). Gunakan ID akun iklan klien di Pengaturan → Google Ads, atau sinkronkan akun dari OAuth.",
        code: "REQUESTED_METRICS_FOR_MANAGER",
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
  }

  return googleAdsJson({
    error: "No metrics could be loaded for this view",
    code: "UNSUPPORTED_METRICS",
    unsupported_metrics: clientUnsupportedMetrics(),
  }, 400);
});
