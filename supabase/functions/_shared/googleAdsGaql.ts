import {
  googleAdsApiVersion,
  parseGoogleAdsErrorMessage,
  type GoogleAdsConfig,
} from "../google-ads-upload-offline-conversion/googleAdsHelpers.ts";

export type GaqlSearchPageResult<T> = {
  results: T[];
  nextPageToken: string | null;
};

function googleAdsRequestHeaders(
  config: GoogleAdsConfig,
  accessToken: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": config.developerToken,
    "Content-Type": "application/json",
  };
  if (config.loginCustomerId) {
    headers["login-customer-id"] = config.loginCustomerId;
  }
  return headers;
}

export async function gaqlSearchPage<T extends Record<string, unknown>>(
  config: GoogleAdsConfig,
  accessToken: string,
  customerId: string,
  query: string,
  pageToken?: string | null,
): Promise<GaqlSearchPageResult<T>> {
  const apiVersion = googleAdsApiVersion();
  const body: Record<string, string> = { query };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers: googleAdsRequestHeaders(config, accessToken),
      body: JSON.stringify(body),
    },
  );
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(parseGoogleAdsErrorMessage(json));
  }
  const results = (json.results as T[] | undefined) ?? [];
  const next =
    json.nextPageToken != null && String(json.nextPageToken).trim() !== ""
      ? String(json.nextPageToken)
      : null;
  return { results, nextPageToken: next };
}

/** Legacy helper: first page only. */
export async function gaqlSearch<T extends Record<string, unknown>>(
  config: GoogleAdsConfig,
  accessToken: string,
  customerId: string,
  query: string,
): Promise<T[]> {
  const page = await gaqlSearchPage<T>(config, accessToken, customerId, query);
  return page.results;
}

const LIST_GAQL_MAX_PAGES = 5;

/** Paginated GAQL search for list/report queries (bounded page count). */
export async function fetchAllGaqlListRows(
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

// --- Manager (MCC) account helpers (metrics must query client accounts, not MCC) ---

export type GoogleAdsClientAccount = {
  customerId: string;
  descriptiveName: string;
};

function gaqlDigitsOnly(value: string, len?: number): string {
  const d = value.replace(/\D/g, "");
  if (len != null && d.length !== len) return "";
  return d;
}

function clientIdFromResourceName(resource: unknown): string {
  const s = String(resource ?? "").trim();
  const m = s.match(/customers\/(\d+)/);
  return m?.[1] ? gaqlDigitsOnly(m[1], 10) : gaqlDigitsOnly(s, 10);
}

/** Config with login-customer-id set to the MCC when querying through a manager. */
export function withManagerLogin(
  config: GoogleAdsConfig,
  managerCustomerId: string,
): GoogleAdsConfig {
  const mcc = gaqlDigitsOnly(managerCustomerId, 10);
  return {
    ...config,
    loginCustomerId: mcc || config.loginCustomerId,
  };
}

export async function isManagerCustomerAccount(
  config: GoogleAdsConfig,
  accessToken: string,
  customerId: string,
): Promise<boolean> {
  const cid = gaqlDigitsOnly(customerId, 10);
  if (!cid) return false;
  const cfg = withManagerLogin(config, cid);
  try {
    const rows = await gaqlSearch<{ customer?: { manager?: boolean; id?: string } }>(
      cfg,
      accessToken,
      cid,
      "SELECT customer.id, customer.manager FROM customer LIMIT 1",
    );
    return rows[0]?.customer?.manager === true;
  } catch {
    return false;
  }
}

/** Direct child client accounts under an MCC (level 1). */
export async function listEnabledClientAccountsUnderManager(
  config: GoogleAdsConfig,
  accessToken: string,
  managerCustomerId: string,
): Promise<GoogleAdsClientAccount[]> {
  const mcc = gaqlDigitsOnly(managerCustomerId, 10);
  if (!mcc) return [];
  const cfg = withManagerLogin(config, mcc);
  const rows = await gaqlSearch<{
    customerClient?: {
      clientCustomer?: string;
      descriptiveName?: string;
      status?: string;
      manager?: boolean;
      level?: number;
    };
  }>(
    cfg,
    accessToken,
    mcc,
    `SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.status, customer_client.manager, customer_client.level
     FROM customer_client
     WHERE customer_client.level = 1
       AND customer_client.status = 'ENABLED'
       AND customer_client.manager = false`,
  );

  const out: GoogleAdsClientAccount[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const cc = row.customerClient;
    if (!cc || cc.manager === true) continue;
    const id = clientIdFromResourceName(cc.clientCustomer);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      customerId: id,
      descriptiveName: String(cc.descriptiveName ?? "").trim() || id,
    });
  }
  return out;
}
