import {
  BLIBLI_CHAT_OTT_PATH,
  blibliSellerApiBase,
  buildBlibliBasicAuthHeader,
  buildBlibliChatIframeUrl,
  blibliSellerCenterOrigin,
  readBlibliPlatformConfig,
  type BlibliPlatformConfig,
} from "./blibliSellerAuth.ts";
import { buildBlibliSignatureHeaders } from "./blibliSellerSign.ts";

export type MintBlibliChatOttParams = {
  storeCode: string;
  storeId: number;
  username: string;
  apiSellerKey: string;
  signatureKey?: string | null;
  requestId?: string;
  platform?: BlibliPlatformConfig;
};

export type MintBlibliChatOttSuccess = {
  ok: true;
  token: string;
  iframeUrl: string;
  requestId: string;
};

export type MintBlibliChatOttFailure = {
  ok: false;
  status: number;
  errorCode?: string | null;
  errorMessage: string;
  requestId: string;
  raw?: unknown;
};

export type MintBlibliChatOttResult = MintBlibliChatOttSuccess | MintBlibliChatOttFailure;

function newRequestId(channelId: string): string {
  return `${channelId}-${crypto.randomUUID()}`;
}

/**
 * Call Blibli GET /proxy/seller/v1/chats/tokens and return OTT + iframe URL.
 */
export async function mintBlibliChatOtt(
  params: MintBlibliChatOttParams,
): Promise<MintBlibliChatOttResult> {
  const platform = params.platform ?? readBlibliPlatformConfig();
  if (!platform) {
    return {
      ok: false,
      status: 503,
      errorMessage: "Blibli platform credentials are not configured",
      requestId: params.requestId ?? "n/a",
    };
  }

  const requestId = params.requestId?.trim() || newRequestId(platform.channelId);
  const query = new URLSearchParams({
    requestId,
    storeCode: params.storeCode.trim(),
    username: params.username.trim(),
    storeId: String(params.storeId),
    channelId: platform.channelId,
  });

  const pathWithQuery = `${BLIBLI_CHAT_OTT_PATH}?${query.toString()}`;
  const url = `${blibliSellerApiBase()}${pathWithQuery}`;

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
      method: "GET",
      requestUrl: pathWithQuery,
      contentType: "application/json",
      body: "",
      signatureTimeMillis,
    });
    headers.Signature = signed.Signature;
    headers["Signature-Time"] = signed["Signature-Time"];
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      errorMessage: e instanceof Error ? e.message : "Failed to reach Blibli API",
      requestId,
    };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const content = (json.content ?? null) as Record<string, unknown> | null;
  const token = content && typeof content.token === "string" ? content.token.trim() : "";

  if (!res.ok || !token) {
    return {
      ok: false,
      status: res.status || 502,
      errorCode: typeof json.errorCode === "string" ? json.errorCode : null,
      errorMessage:
        typeof json.errorMessage === "string" && json.errorMessage.trim()
          ? json.errorMessage.trim()
          : `Blibli OTT request failed (${res.status})`,
      requestId: typeof json.requestId === "string" ? json.requestId : requestId,
      raw: json,
    };
  }

  return {
    ok: true,
    token,
    iframeUrl: buildBlibliChatIframeUrl(token, blibliSellerCenterOrigin()),
    requestId: typeof json.requestId === "string" ? json.requestId : requestId,
  };
}
