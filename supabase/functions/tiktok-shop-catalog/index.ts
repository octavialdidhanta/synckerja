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
import { searchTikTokShopProducts } from "../_shared/tiktokShopApi.ts";
import { resolveOrgTikTokShopForOrders } from "../_shared/tiktokShopOrgResolver.ts";

const CACHE_TTL_MINUTES = 10;

function isScopeOrAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("access denied") ||
    lower.includes("scope") ||
    lower.includes("permission") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid access token") ||
    lower.includes("product")
  );
}

function buildProductCachePageToken(pageToken: string, status: string): string {
  const st = status.trim();
  const token = pageToken.trim();
  if (!st) return token;
  return `${st}::${token}`;
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

    const action = String(body.action ?? "getProductList").trim();
    if (action !== "getProductList") {
      return tiktokShopJson({ error: "Unknown action" }, 400);
    }

    const shopAccountId = body.shop_account_id != null
      ? String(body.shop_account_id).trim()
      : body.shop_id != null
        ? String(body.shop_id).trim()
        : null;
    const pageToken = body.page_token != null ? String(body.page_token).trim() : "";
    const status = body.status != null ? String(body.status).trim() : "";
    const forceRefresh = body.force_refresh === true;
    const now = new Date();

    const resolved = await resolveOrgTikTokShopForOrders(admin, organizationId, shopAccountId);
    if (!resolved) {
      return tiktokShopJson({
        error: "TikTok Shop not connected or no shop configured",
        code: "TIKTOK_SHOP_NOT_CONNECTED",
      }, 400);
    }

    const { accessToken, account } = resolved;
    const shopId = account.shop_id;
    const cachePageToken = buildProductCachePageToken(pageToken, status);

    if (!forceRefresh) {
      const { data: cached, error: cacheReadErr } = await admin
        .from("organization_tiktok_shop_products_cache")
        .select("response_json, fetched_at")
        .eq("organization_id", organizationId)
        .eq("shop_id", shopId)
        .eq("status_filter", status || "")
        .eq("page_token", cachePageToken)
        .gt("expires_at", now.toISOString())
        .maybeSingle();
      if (cacheReadErr) {
        console.warn("tiktok-shop-catalog cache read:", cacheReadErr.message);
      } else if (cached?.response_json) {
        return tiktokShopJson({ ...(cached.response_json as object), cached: true }, 200);
      }
    }

    const oauth = readPlatformTikTokShopOAuth();
    if (!oauth) return tiktokShopJson({ error: "Platform not configured" }, 503);

    try {
      const searchResult = await searchTikTokShopProducts(
        oauth,
        accessToken,
        account.shop_cipher,
        {
          pageSize: 50,
          pageToken: pageToken || undefined,
          status: status || undefined,
        },
      );

      const payload = {
        rows: searchResult.products,
        summary: {
          total_count: searchResult.total_count ?? searchResult.products.length,
        },
        shop_account_id: account.id,
        shop_id: shopId,
        shop_name: account.shop_name ?? account.label,
        status: status || null,
        next_page_token: searchResult.next_page_token,
        fetched_at: now.toISOString(),
      };

      const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60_000).toISOString();
      const { error: cacheErr } = await admin.from("organization_tiktok_shop_products_cache").upsert({
        organization_id: organizationId,
        shop_id: shopId,
        status_filter: status || "",
        page_token: cachePageToken,
        response_json: payload,
        fetched_at: now.toISOString(),
        expires_at: expiresAt,
      }, {
        onConflict: "organization_id,shop_id,status_filter,page_token",
      });
      if (cacheErr) {
        console.warn("tiktok-shop-catalog cache upsert:", cacheErr.message);
      }

      return tiktokShopJson(payload, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("tiktok-shop-catalog search:", msg);
      const code = isScopeOrAuthError(msg)
        ? "TIKTOK_SHOP_PRODUCT_SCOPE_ERROR"
        : "TIKTOK_SHOP_API_ERROR";
      return tiktokShopJson({
        error: msg,
        code,
        shop_id: shopId,
        shop_account_id: account.id,
      }, 400);
    }
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("tiktok-shop-catalog unhandled:", msg);
    return tiktokShopJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
});
