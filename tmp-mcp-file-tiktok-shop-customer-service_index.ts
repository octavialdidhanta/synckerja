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
  listTikTokShopConversations,
  TikTokShopApiError,
} from "../_shared/tiktokShopApi.ts";
import { getTikTokShopAccessToken } from "../_shared/tiktokShopOrgResolver.ts";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 30 * 60 * 1000;

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
    case 45101001:
    case 36009003:
      return "TTS_INTERNAL";
    default:
      return "TIKTOK_SHOP_API_ERROR";
  }
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

  if (action !== "listConversations") {
    return tiktokShopJson({ error: `Unknown action: ${action}` }, 400);
  }

  const accountIdHint = String(body.account_id ?? "").trim();
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

  const oauth = readPlatformTikTokShopOAuth();
  if (!oauth) {
    return tiktokShopJson({ error: "TikTok Shop is not configured on server." }, 503);
  }

  let accessToken: string | null;
  try {
    accessToken = await getTikTokShopAccessToken(admin, organizationId, account.seller_open_id);
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

  const localeRaw = String(body.locale ?? "en").trim();
  const locale = localeRaw.toLowerCase().startsWith("id") ? "id-ID" : "en";
  const pageToken = String(body.page_token ?? "").trim();

  async function recordCall(requestId?: string) {
    await admin.from("tiktok_shop_cs_api_calls").insert({
      organization_id: organizationId,
      account_id: account!.id,
      shop_id: account!.shop_id,
      action: "listConversations",
      request_id: requestId ?? null,
      created_at: new Date().toISOString(),
    });
    const pruneBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await admin.from("tiktok_shop_cs_api_calls").delete().lt("created_at", pruneBefore);
  }

  try {
    const result = await listTikTokShopConversations(oauth, accessToken, {
      shop_cipher: account.shop_cipher,
      page_size: 20,
      page_token: pageToken || undefined,
      locale,
    });
    await recordCall(result.requestId);
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
    const msg = e instanceof Error ? e.message : String(e);
    console.error("tiktok-shop-customer-service listConversations:", msg);
    await recordCall(apiErr?.requestId);
    const ttsCode = apiErr?.code;
    return tiktokShopJson(
      {
        error: msg,
        code: mapCsErrorCode(ttsCode),
        tts_code: ttsCode ?? null,
        request_id: apiErr?.requestId ?? null,
        shop_id: account.shop_id,
        shop_account_id: account.id,
      },
      400,
    );
  }
});
