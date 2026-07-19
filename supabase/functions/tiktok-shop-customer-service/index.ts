/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  requireTikTokShopPlatformConfigured,
  readPlatformTikTokShopOAuth,
  tiktokShopCorsHeaders,
  tiktokShopJson,
  type TikTokShopPlatformOAuth,
} from "../_shared/tiktokShopAuth.ts";
import {
  createTikTokShopConversation,
  getTikTokShopOrderDetails,
  listTikTokShopConversationMessages,
  listTikTokShopConversations,
  readTikTokShopConversationMessages,
  sendTikTokShopConversationMessage,
  uploadTikTokShopBuyerMessageImage,
  TikTokShopApiError,
} from "../_shared/tiktokShopApi.ts";
import { getTikTokShopAccessToken, withTikTokShopAccessTokenRetry } from "../_shared/tiktokShopOrgResolver.ts";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 30 * 60 * 1000;
const MAX_TEXT_LENGTH = 2000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

type ShopAccountRow = {
  id: string;
  seller_open_id: string;
  shop_id: string;
  shop_cipher: string;
  shop_name: string | null;
  is_default: boolean;
  is_active: boolean;
};

function mapCsErrorCode(ttsCode: number | undefined): string {
  switch (ttsCode) {
    case 45101004:
      return "TTS_DAILY_QUOTA";
    case 45101003:
      return "TTS_NOT_FOUND";
    case 45101002:
      return "TTS_INVALID_PARAMS";
    case 45101006:
      return "TTS_SENSITIVE";
    case 45102007:
      return "TTS_NO_PERMISSION";
    case 45109001:
      return "TTS_CONVERSATION_RULE";
    case 45109003:
      return "TTS_CREATE_CONVERSATION_CRITERIA";
    case 45101001:
    case 36009003:
      return "TTS_INTERNAL";
    default:
      return "TIKTOK_SHOP_API_ERROR";
  }
}

function normalizeLocale(raw: string): string {
  return raw.toLowerCase().startsWith("id") ? "id-ID" : "en";
}

async function resolveAccount(
  admin: SupabaseClient,
  organizationId: string,
  accountIdHint: string,
): Promise<ShopAccountRow | Response> {
  let accountQuery = admin
    .from("organization_tiktok_shop_accounts")
    .select("id, seller_open_id, shop_id, shop_cipher, shop_name, is_default, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (accountIdHint) {
    accountQuery = accountQuery.eq("id", accountIdHint);
  } else {
    accountQuery = accountQuery
      .order("is_default", { ascending: false })
      .order("sort_order", { ascending: true });
  }

  const { data: accounts, error: accErr } = await accountQuery.limit(1);
  if (accErr) return tiktokShopJson({ error: accErr.message }, 500);

  const account = (accounts ?? [])[0] as ShopAccountRow | undefined;
  if (!account?.shop_cipher || !account.seller_open_id) {
    return tiktokShopJson(
      {
        error: "No active TikTok Shop account. Connect TikTok Shop in Settings.",
        code: "NOT_CONNECTED",
      },
      400,
    );
  }
  return account;
}

async function gateRateLimit(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Response | null> {
  const nowMs = Date.now();
  const windowStartIso = new Date(nowMs - RATE_WINDOW_MS).toISOString();
  const { data: callRows } = await admin
    .from("tiktok_shop_cs_api_calls")
    .select("created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", windowStartIso)
    .order("created_at", { ascending: true });

  const stamps = (callRows ?? []).map((r) => String((r as { created_at: string }).created_at));
  if (stamps.length >= RATE_LIMIT) {
    const oldest = stamps[0] ? new Date(stamps[0]).getTime() : nowMs;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + RATE_WINDOW_MS - nowMs) / 1000),
    );
    return tiktokShopJson(
      {
        error:
          "TikTok Shop chat API rate limit reached (60 requests per 30 minutes). Try again later.",
        code: "RATE_LIMIT",
        retryAfterSeconds,
      },
      429,
    );
  }
  return null;
}

async function resolveAccessToken(
  admin: SupabaseClient,
  organizationId: string,
  sellerOpenId: string,
): Promise<string | Response> {
  let accessToken: string | null;
  try {
    accessToken = await getTikTokShopAccessToken(admin, organizationId, sellerOpenId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return tiktokShopJson(
      { error: msg || "Failed to load TikTok Shop access token", code: "TOKEN_ERROR" },
      400,
    );
  }
  if (!accessToken) {
    return tiktokShopJson(
      {
        error: "TikTok Shop access token unavailable. Reconnect in Settings.",
        code: "TOKEN_ERROR",
      },
      400,
    );
  }
  return accessToken;
}

async function recordCall(
  admin: SupabaseClient,
  organizationId: string,
  account: ShopAccountRow,
  action: string,
  requestId?: string,
) {
  await admin.from("tiktok_shop_cs_api_calls").insert({
    organization_id: organizationId,
    account_id: account.id,
    shop_id: account.shop_id,
    action,
    request_id: requestId ?? null,
    created_at: new Date().toISOString(),
  });
  const pruneBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await admin.from("tiktok_shop_cs_api_calls").delete().lt("created_at", pruneBefore);
}

function apiErrorResponse(
  e: unknown,
  account: ShopAccountRow,
  logLabel: string,
): Response {
  const apiErr = e instanceof TikTokShopApiError ? e : null;
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`tiktok-shop-customer-service ${logLabel}:`, msg);
  return tiktokShopJson(
    {
      error: msg,
      code: mapCsErrorCode(apiErr?.code),
      tts_code: apiErr?.code ?? null,
      request_id: apiErr?.requestId ?? null,
      shop_id: account.shop_id,
      shop_account_id: account.id,
    },
    400,
  );
}

function csWithTokenRetry<T>(
  admin: SupabaseClient,
  organizationId: string,
  account: ShopAccountRow,
  accessToken: string,
  fn: (token: string) => Promise<T>,
): Promise<T> {
  return withTikTokShopAccessTokenRetry(
    admin,
    organizationId,
    account.seller_open_id,
    accessToken,
    fn,
  );
}

Deno.serve(async (req: Request) => {
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

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return tiktokShopJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return tiktokShopJson({ error: "Missing organization_id" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
  if (orgForbidden) return orgForbidden;

  const platformForbidden = requireTikTokShopPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  if (
    action !== "listConversations" &&
    action !== "listMessages" &&
    action !== "sendMessage" &&
    action !== "sendImageMessage" &&
    action !== "readMessages" &&
    action !== "createConversation"
  ) {
    return tiktokShopJson({ error: `Unknown action: ${action}` }, 400);
  }

  const accountOrErr = await resolveAccount(
    admin,
    organizationId,
    String(body.account_id ?? "").trim(),
  );
  if (accountOrErr instanceof Response) return accountOrErr;
  const account = accountOrErr;

  const limited = await gateRateLimit(admin, organizationId);
  if (limited) return limited;

  const oauth = readPlatformTikTokShopOAuth();
  if (!oauth) {
    return tiktokShopJson({ error: "TikTok Shop is not configured on server." }, 503);
  }

  const tokenOrErr = await resolveAccessToken(admin, organizationId, account.seller_open_id);
  if (typeof tokenOrErr !== "string") return tokenOrErr;
  const accessToken = tokenOrErr;

  const locale = normalizeLocale(String(body.locale ?? "en").trim());
  const pageToken = String(body.page_token ?? "").trim();

  if (action === "createConversation") {
    return handleCreateConversation({
      admin,
      organizationId,
      account,
      oauth,
      accessToken,
      orderId: String(body.order_id ?? "").trim(),
    });
  }

  if (action === "readMessages") {
    return handleReadMessages({
      admin,
      organizationId,
      account,
      oauth,
      accessToken,
      conversationId: String(body.conversation_id ?? "").trim(),
    });
  }

  if (action === "sendMessage") {
    return handleSendMessage({
      admin,
      organizationId,
      account,
      oauth,
      accessToken,
      conversationId: String(body.conversation_id ?? "").trim(),
      text: String(body.text ?? ""),
    });
  }

  if (action === "sendImageMessage") {
    return handleSendImageMessage({
      admin,
      organizationId,
      account,
      oauth,
      accessToken,
      conversationId: String(body.conversation_id ?? "").trim(),
      imageBase64: String(body.image_base64 ?? ""),
      contentType: String(body.content_type ?? "").trim().toLowerCase(),
      filename: String(body.filename ?? "").trim(),
    });
  }

  if (action === "listMessages") {
    return handleListMessages({
      admin,
      organizationId,
      account,
      oauth,
      accessToken,
      locale,
      pageToken,
      conversationId: String(body.conversation_id ?? "").trim(),
    });
  }

  return handleListConversations({
    admin,
    organizationId,
    account,
    oauth,
    accessToken,
    locale,
    pageToken,
  });
});

async function handleCreateConversation(params: {
  admin: SupabaseClient;
  organizationId: string;
  account: ShopAccountRow;
  oauth: TikTokShopPlatformOAuth;
  accessToken: string;
  orderId: string;
}): Promise<Response> {
  const { admin, organizationId, account, oauth, accessToken, orderId } = params;

  if (!orderId) {
    return tiktokShopJson({ error: "Missing order_id", code: "VALIDATION" }, 400);
  }

  try {
    const { buyerUserId, result } = await csWithTokenRetry(
      admin,
      organizationId,
      account,
      accessToken,
      async (token) => {
        const details = await getTikTokShopOrderDetails(
          oauth,
          token,
          account.shop_cipher,
          [orderId],
        );
        const order = details.orders.find((o) => o.order_id === orderId) ?? details.orders[0];
        const buyerUserId = String(order?.buyer_user_id ?? "").trim();
        if (!buyerUserId) {
          const err = new Error("Order has no buyer_user_id; cannot create conversation");
          (err as Error & { code?: string }).code = "MISSING_BUYER_USER_ID";
          throw err;
        }
        const result = await createTikTokShopConversation(oauth, token, {
          shop_cipher: account.shop_cipher,
          buyer_user_id: buyerUserId,
        });
        return { buyerUserId, result };
      },
    );
    await recordCall(admin, organizationId, account, "createConversation", result.requestId);
    return tiktokShopJson(
      {
        conversation_id: result.data.conversation_id,
        buyer_user_id: buyerUserId,
        order_id: orderId,
        account: {
          id: account.id,
          shop_id: account.shop_id,
          shop_name: account.shop_name,
        },
        request_id: result.requestId ?? null,
      },
      200,
    );
  } catch (e) {
    const missing = e instanceof Error &&
      (e as Error & { code?: string }).code === "MISSING_BUYER_USER_ID";
    if (missing) {
      return tiktokShopJson(
        {
          error: "Order has no buyer_user_id; cannot create conversation",
          code: "MISSING_BUYER_USER_ID",
        },
        400,
      );
    }
    const apiErr = e instanceof TikTokShopApiError ? e : null;
    await recordCall(admin, organizationId, account, "createConversation", apiErr?.requestId);
    return apiErrorResponse(e, account, "createConversation");
  }
}

async function handleListConversations(params: {
  admin: SupabaseClient;
  organizationId: string;
  account: ShopAccountRow;
  oauth: TikTokShopPlatformOAuth;
  accessToken: string;
  locale: string;
  pageToken: string;
}): Promise<Response> {
  const { admin, organizationId, account, oauth, accessToken, locale, pageToken } = params;
  try {
    const result = await csWithTokenRetry(
      admin,
      organizationId,
      account,
      accessToken,
      (token) =>
        listTikTokShopConversations(oauth, token, {
          shop_cipher: account.shop_cipher,
          page_size: 20,
          page_token: pageToken || undefined,
          locale,
        }),
    );
    await recordCall(admin, organizationId, account, "listConversations", result.requestId);
    return tiktokShopJson(
      {
        next_page_token: result.data.next_page_token ?? "",
        conversations: result.data.conversations,
        account: {
          id: account.id,
          shop_id: account.shop_id,
          shop_name: account.shop_name,
        },
        request_id: result.requestId ?? null,
      },
      200,
    );
  } catch (e) {
    const apiErr = e instanceof TikTokShopApiError ? e : null;
    await recordCall(admin, organizationId, account, "listConversations", apiErr?.requestId);
    return apiErrorResponse(e, account, "listConversations");
  }
}

async function handleListMessages(params: {
  admin: SupabaseClient;
  organizationId: string;
  account: ShopAccountRow;
  oauth: TikTokShopPlatformOAuth;
  accessToken: string;
  locale: string;
  pageToken: string;
  conversationId: string;
}): Promise<Response> {
  const {
    admin,
    organizationId,
    account,
    oauth,
    accessToken,
    locale,
    pageToken,
    conversationId,
  } = params;

  if (!conversationId) {
    return tiktokShopJson({ error: "Missing conversation_id", code: "VALIDATION" }, 400);
  }

  try {
    const result = await csWithTokenRetry(
      admin,
      organizationId,
      account,
      accessToken,
      (token) =>
        listTikTokShopConversationMessages(oauth, token, {
          conversation_id: conversationId,
          shop_cipher: account.shop_cipher,
          page_size: 10,
          page_token: pageToken || undefined,
          locale,
          sort_order: "DESC",
          sort_field: "create_time",
          need_plaintext: true,
          need_data: false,
          time_zone: "Asia/Jakarta",
        }),
    );
    await recordCall(admin, organizationId, account, "listMessages", result.requestId);
    return tiktokShopJson(
      {
        next_page_token: result.data.next_page_token ?? "",
        unsupported_msg_tips: result.data.unsupported_msg_tips ?? "",
        messages: result.data.messages,
        account: {
          id: account.id,
          shop_id: account.shop_id,
          shop_name: account.shop_name,
        },
        request_id: result.requestId ?? null,
      },
      200,
    );
  } catch (e) {
    const apiErr = e instanceof TikTokShopApiError ? e : null;
    await recordCall(admin, organizationId, account, "listMessages", apiErr?.requestId);
    return apiErrorResponse(e, account, "listMessages");
  }
}

async function handleSendMessage(params: {
  admin: SupabaseClient;
  organizationId: string;
  account: ShopAccountRow;
  oauth: TikTokShopPlatformOAuth;
  accessToken: string;
  conversationId: string;
  text: string;
}): Promise<Response> {
  const { admin, organizationId, account, oauth, accessToken, conversationId, text } = params;

  if (!conversationId) {
    return tiktokShopJson({ error: "Missing conversation_id", code: "VALIDATION" }, 400);
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return tiktokShopJson({ error: "Message text is required", code: "VALIDATION" }, 400);
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return tiktokShopJson(
      {
        error: `Message text exceeds ${MAX_TEXT_LENGTH} characters`,
        code: "VALIDATION",
      },
      400,
    );
  }

  try {
    const result = await csWithTokenRetry(
      admin,
      organizationId,
      account,
      accessToken,
      (token) =>
        sendTikTokShopConversationMessage(oauth, token, {
          conversation_id: conversationId,
          shop_cipher: account.shop_cipher,
          type: "TEXT",
          content: JSON.stringify({ content: trimmed }),
          sender_role: "CUSTOMER_SERVICE",
        }),
    );
    await recordCall(admin, organizationId, account, "sendMessage", result.requestId);
    return tiktokShopJson(
      {
        message_id: result.data.message_id,
        account: {
          id: account.id,
          shop_id: account.shop_id,
          shop_name: account.shop_name,
        },
        request_id: result.requestId ?? null,
      },
      200,
    );
  } catch (e) {
    const apiErr = e instanceof TikTokShopApiError ? e : null;
    await recordCall(admin, organizationId, account, "sendMessage", apiErr?.requestId);
    return apiErrorResponse(e, account, "sendMessage");
  }
}

function decodeImageBase64(raw: string): Uint8Array | null {
  let value = raw.trim();
  if (!value) return null;
  const dataUrl = value.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrl) value = dataUrl[2] ?? "";
  value = value.replace(/\s/g, "");
  if (!value) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    case "image/jpg":
    default:
      return "jpg";
  }
}

async function handleSendImageMessage(params: {
  admin: SupabaseClient;
  organizationId: string;
  account: ShopAccountRow;
  oauth: TikTokShopPlatformOAuth;
  accessToken: string;
  conversationId: string;
  imageBase64: string;
  contentType: string;
  filename: string;
}): Promise<Response> {
  const {
    admin,
    organizationId,
    account,
    oauth,
    accessToken,
    conversationId,
    imageBase64,
    contentType,
    filename,
  } = params;

  if (!conversationId) {
    return tiktokShopJson({ error: "Missing conversation_id", code: "VALIDATION" }, 400);
  }

  const mime = contentType === "image/jpg" ? "image/jpeg" : contentType;
  if (!ALLOWED_IMAGE_TYPES.has(mime)) {
    return tiktokShopJson(
      {
        error: "Image must be jpg, png, gif, or webp",
        code: "INVALID_IMAGE",
      },
      400,
    );
  }

  const bytes = decodeImageBase64(imageBase64);
  if (!bytes?.length) {
    return tiktokShopJson(
      { error: "Invalid or empty image_base64", code: "INVALID_IMAGE" },
      400,
    );
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return tiktokShopJson(
      { error: "Image must not exceed 10MB", code: "IMAGE_TOO_LARGE" },
      400,
    );
  }

  const safeName =
    filename.replace(/[^\w.\-]+/g, "_").slice(0, 120) ||
    `image.${extensionForContentType(mime)}`;

  try {
    const { uploaded, sent } = await csWithTokenRetry(
      admin,
      organizationId,
      account,
      accessToken,
      async (token) => {
        const uploaded = await uploadTikTokShopBuyerMessageImage(oauth, token, {
          shop_cipher: account.shop_cipher,
          bytes,
          content_type: mime,
          filename: safeName,
        });
        const content = JSON.stringify({
          url: uploaded.data.url,
          width: uploaded.data.width,
          height: uploaded.data.height,
        });
        const sent = await sendTikTokShopConversationMessage(oauth, token, {
          conversation_id: conversationId,
          shop_cipher: account.shop_cipher,
          type: "IMAGE",
          content,
          sender_role: "CUSTOMER_SERVICE",
        });
        return { uploaded, sent };
      },
    );
    await recordCall(admin, organizationId, account, "uploadImage", uploaded.requestId);
    await recordCall(admin, organizationId, account, "sendImageMessage", sent.requestId);

    return tiktokShopJson(
      {
        message_id: sent.data.message_id,
        url: uploaded.data.url,
        width: uploaded.data.width,
        height: uploaded.data.height,
        account: {
          id: account.id,
          shop_id: account.shop_id,
          shop_name: account.shop_name,
        },
        request_id: sent.requestId ?? uploaded.requestId ?? null,
      },
      200,
    );
  } catch (e) {
    const apiErr = e instanceof TikTokShopApiError ? e : null;
    await recordCall(admin, organizationId, account, "sendImageMessage", apiErr?.requestId);
    return apiErrorResponse(e, account, "sendImageMessage");
  }
}

async function handleReadMessages(params: {
  admin: SupabaseClient;
  organizationId: string;
  account: ShopAccountRow;
  oauth: TikTokShopPlatformOAuth;
  accessToken: string;
  conversationId: string;
}): Promise<Response> {
  const { admin, organizationId, account, oauth, accessToken, conversationId } = params;

  if (!conversationId) {
    return tiktokShopJson({ error: "Missing conversation_id", code: "VALIDATION" }, 400);
  }

  try {
    const result = await csWithTokenRetry(
      admin,
      organizationId,
      account,
      accessToken,
      (token) =>
        readTikTokShopConversationMessages(oauth, token, {
          conversation_id: conversationId,
          shop_cipher: account.shop_cipher,
        }),
    );
    await recordCall(admin, organizationId, account, "readMessages", result.requestId);
    return tiktokShopJson(
      {
        ok: true,
        account: {
          id: account.id,
          shop_id: account.shop_id,
          shop_name: account.shop_name,
        },
        request_id: result.requestId ?? null,
      },
      200,
    );
  } catch (e) {
    const apiErr = e instanceof TikTokShopApiError ? e : null;
    await recordCall(admin, organizationId, account, "readMessages", apiErr?.requestId);
    return apiErrorResponse(e, account, "readMessages");
  }
}
