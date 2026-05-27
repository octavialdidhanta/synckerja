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
