import {
  blibliSellerApiBase,
  buildBlibliBasicAuthHeader,
  readBlibliPlatformConfig,
  type BlibliPlatformConfig,
} from "./blibliSellerAuth.ts";
import { buildBlibliSignatureHeaders } from "./blibliSellerSign.ts";

export type BlibliSellerRequestParams = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path starting with / including query string for signature (e.g. /proxy/seller/v1/...). */
  pathWithQuery: string;
  apiSellerKey: string;
  signatureKey?: string | null;
  body?: string;
  platform?: BlibliPlatformConfig;
};

export type BlibliSellerRequestResult = {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
  requestIdHint: string;
};

export function newBlibliRequestId(channelId: string): string {
  return `${channelId}-${crypto.randomUUID()}`;
}

/**
 * Authenticated Blibli Seller API call (Basic + Api-Seller-Key + optional Signature).
 */
export async function blibliSellerRequest(
  params: BlibliSellerRequestParams,
): Promise<BlibliSellerRequestResult> {
  const platform = params.platform ?? readBlibliPlatformConfig();
  if (!platform) {
    return {
      ok: false,
      status: 503,
      json: { errorMessage: "Blibli platform credentials are not configured" },
      requestIdHint: "n/a",
    };
  }

  const method = params.method.trim().toUpperCase() as BlibliSellerRequestParams["method"];
  const body = params.body ?? "";
  const headers: Record<string, string> = {
    Authorization: buildBlibliBasicAuthHeader(platform.apiClientId, platform.apiClientKey),
    Accept: "application/json",
    "Content-Type": "application/json",
    "Api-Seller-Key": params.apiSellerKey.trim(),
  };

  const signatureKey = params.signatureKey?.trim();
  if (signatureKey) {
    const signatureTimeMillis = Date.now();
    const signed = await buildBlibliSignatureHeaders({
      signatureKey,
      method,
      requestUrl: params.pathWithQuery,
      contentType: "application/json",
      body,
      signatureTimeMillis,
    });
    headers.Signature = signed.Signature;
    headers["Signature-Time"] = signed["Signature-Time"];
  }

  const url = `${blibliSellerApiBase()}${params.pathWithQuery}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: method === "GET" || method === "DELETE" ? undefined : body || undefined,
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      json: {
        errorMessage: e instanceof Error ? e.message : "Failed to reach Blibli API",
      },
      requestIdHint: "n/a",
    };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    ok: res.ok,
    status: res.status,
    json,
    requestIdHint: typeof json.requestId === "string" ? json.requestId : "n/a",
  };
}

export function buildBlibliCommonQuery(params: {
  requestId: string;
  storeCode: string;
  username: string;
  storeId: number;
  channelId: string;
}): string {
  const q = new URLSearchParams({
    requestId: params.requestId,
    storeCode: params.storeCode.trim(),
    username: params.username.trim(),
    storeId: String(params.storeId),
    channelId: params.channelId,
  });
  return q.toString();
}
