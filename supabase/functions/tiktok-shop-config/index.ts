/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  isTikTokShopPlatformConfigured,
  requireActiveOrg,
  requireOrgAdmin,
  requireTikTokShopPlatformConfigured,
  readPlatformTikTokShopOAuth,
  tiktokShopCorsHeaders,
  tiktokShopJson,
} from "../_shared/tiktokShopAuth.ts";
import {
  fetchAndSyncAuthorizedShops,
  getTikTokShopAccessToken,
  listTikTokShopSellerOpenIds,
} from "../_shared/tiktokShopOrgResolver.ts";
import { getTikTokShopAuthorizedShops } from "../_shared/tiktokShopApi.ts";

type ShopAccountRow = {
  id: string;
  seller_open_id: string;
  shop_id: string;
  shop_cipher: string;
  shop_name: string | null;
  region: string | null;
  seller_type: string | null;
  label: string;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
};

type TokenMetaRow = {
  seller_open_id: string;
  seller_name: string | null;
  seller_base_region: string | null;
};

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

  if (action === "getSettings") {
    const { data: connection } = await admin
      .from("organization_tiktok_shop_connections")
      .select(
        "organization_id, is_active, oauth_connected_at, last_test_at, last_test_ok, last_test_error, updated_at",
      )
      .eq("organization_id", organizationId)
      .maybeSingle();

    const { data: tokenRows } = await admin
      .from("organization_tiktok_shop_connection_tokens")
      .select("seller_open_id, seller_name, seller_base_region")
      .eq("organization_id", organizationId);

    const { data: shopRows } = await admin
      .from("organization_tiktok_shop_accounts")
      .select(
        "id, seller_open_id, shop_id, shop_cipher, shop_name, region, seller_type, label, is_default, sort_order, is_active",
      )
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true });

    const shopsBySeller = new Map<string, ShopAccountRow[]>();
    for (const row of (shopRows ?? []) as ShopAccountRow[]) {
      const sid = String(row.seller_open_id);
      const list = shopsBySeller.get(sid) ?? [];
      list.push(row);
      shopsBySeller.set(sid, list);
    }

    const sellers = ((tokenRows ?? []) as TokenMetaRow[]).map((token) => ({
      seller_open_id: String(token.seller_open_id),
      seller_name: token.seller_name ?? null,
      seller_base_region: token.seller_base_region ?? null,
      shops: shopsBySeller.get(String(token.seller_open_id)) ?? [],
    }));

    return tiktokShopJson({
      connection: connection ?? null,
      oauthConnected: (tokenRows ?? []).length > 0,
      sellers,
      serverConfigured: isTikTokShopPlatformConfigured(),
    }, 200);
  }

  const adminForbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (adminForbidden) return adminForbidden;

  const platformForbidden = requireTikTokShopPlatformConfigured();
  if (platformForbidden && action !== "disconnect") return platformForbidden;

  if (action === "disconnect") {
    const sellerOpenId = body.seller_open_id != null ? String(body.seller_open_id).trim() : "";
    if (sellerOpenId) {
      await admin.from("organization_tiktok_shop_connection_tokens")
        .delete()
        .eq("organization_id", organizationId)
        .eq("seller_open_id", sellerOpenId);
      await admin.from("organization_tiktok_shop_accounts")
        .delete()
        .eq("organization_id", organizationId)
        .eq("seller_open_id", sellerOpenId);
    } else {
      await admin.from("organization_tiktok_shop_connection_tokens")
        .delete()
        .eq("organization_id", organizationId);
      await admin.from("organization_tiktok_shop_accounts")
        .delete()
        .eq("organization_id", organizationId);
    }

    const { data: remaining } = await admin
      .from("organization_tiktok_shop_connection_tokens")
      .select("seller_open_id")
      .eq("organization_id", organizationId);

    if ((remaining ?? []).length === 0) {
      await admin.from("organization_tiktok_shop_connections").upsert({
        organization_id: organizationId,
        oauth_connected_at: null,
        is_active: false,
        last_test_at: null,
        last_test_ok: null,
        last_test_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id" });
    }

    return tiktokShopJson({ ok: true }, 200);
  }

  if (action === "setDefaultShop") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return tiktokShopJson({ error: "Missing account_id" }, 400);
    await admin.from("organization_tiktok_shop_accounts")
      .update({ is_default: false })
      .eq("organization_id", organizationId);
    const { error } = await admin
      .from("organization_tiktok_shop_accounts")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return tiktokShopJson({ error: error.message }, 500);
    return tiktokShopJson({ ok: true }, 200);
  }

  if (action === "deleteShop") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return tiktokShopJson({ error: "Missing account_id" }, 400);
    const { data: acc } = await admin
      .from("organization_tiktok_shop_accounts")
      .select("seller_open_id, shop_id")
      .eq("id", accountId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const { error } = await admin
      .from("organization_tiktok_shop_accounts")
      .delete()
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return tiktokShopJson({ error: error.message }, 500);

    if (acc?.seller_open_id) {
      const sellerId = String(acc.seller_open_id);
      const { data: remainingShops } = await admin
        .from("organization_tiktok_shop_accounts")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("seller_open_id", sellerId);
      if ((remainingShops ?? []).length === 0) {
        await admin.from("organization_tiktok_shop_connection_tokens")
          .delete()
          .eq("organization_id", organizationId)
          .eq("seller_open_id", sellerId);
      }
    }

    return tiktokShopJson({ ok: true }, 200);
  }

  const oauth = readPlatformTikTokShopOAuth()!;

  if (action === "syncAuthorizedShops") {
    const sellerOpenId = String(body.seller_open_id ?? "").trim();
    if (!sellerOpenId) return tiktokShopJson({ error: "Missing seller_open_id" }, 400);
    try {
      const shops = await fetchAndSyncAuthorizedShops(admin, organizationId, sellerOpenId);
      return tiktokShopJson({ ok: true, shop_count: shops.length }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return tiktokShopJson({ error: msg }, 400);
    }
  }

  if (action === "testConnection") {
    const sellerOpenIdParam = body.seller_open_id != null ? String(body.seller_open_id).trim() : "";
    const now = new Date().toISOString();

    const sellerIds = sellerOpenIdParam
      ? [sellerOpenIdParam]
      : await listTikTokShopSellerOpenIds(admin, organizationId);

    if (sellerIds.length === 0) {
      await admin.from("organization_tiktok_shop_connections").update({
        last_test_at: now,
        last_test_ok: false,
        last_test_error: "Not connected",
        updated_at: now,
      }).eq("organization_id", organizationId);
      return tiktokShopJson({ ok: false, error: "Not connected" }, 400);
    }

    try {
      let totalShops = 0;
      for (const sellerId of sellerIds) {
        const accessToken = await getTikTokShopAccessToken(admin, organizationId, sellerId);
        if (!accessToken) throw new Error(`No token for seller ${sellerId}`);
        const shops = await getTikTokShopAuthorizedShops(oauth, accessToken);
        totalShops += shops.length;
      }
      await admin.from("organization_tiktok_shop_connections").update({
        last_test_at: now,
        last_test_ok: true,
        last_test_error: null,
        updated_at: now,
      }).eq("organization_id", organizationId);
      return tiktokShopJson({ ok: true, shop_count: totalShops }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("organization_tiktok_shop_connections").update({
        last_test_at: now,
        last_test_ok: false,
        last_test_error: msg,
        updated_at: now,
      }).eq("organization_id", organizationId);
      return tiktokShopJson({ ok: false, error: msg }, 400);
    }
  }

  return tiktokShopJson({ error: "Unknown action" }, 400);
});
