import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decryptTikTokShopToken,
  encryptTikTokShopToken,
} from "./tiktokShopConfigCrypto.ts";
import { readPlatformTikTokShopOAuth } from "./tiktokShopAuth.ts";
import {
  getTikTokShopAuthorizedShops,
  refreshTikTokShopAccessToken,
  tokenExpiresAtIsoFromTikTokField,
  type TikTokShopAuthorizedShop,
} from "./tiktokShopApi.ts";

export type TikTokShopAccountRow = {
  id: string;
  organization_id: string;
  seller_open_id: string;
  shop_id: string;
  shop_cipher: string;
  shop_name: string | null;
  region: string | null;
  seller_type: string | null;
  label: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

type TokenRow = {
  access_token_enc: string;
  refresh_token_enc: string;
  access_token_expires_at: string | null;
  seller_name: string | null;
  seller_base_region: string | null;
};

export async function getTikTokShopAccessToken(
  admin: SupabaseClient,
  organizationId: string,
  sellerOpenId: string,
): Promise<string | null> {
  const { data: row } = await admin
    .from("organization_tiktok_shop_connection_tokens")
    .select(
      "access_token_enc, refresh_token_enc, access_token_expires_at, seller_name, seller_base_region",
    )
    .eq("organization_id", organizationId)
    .eq("seller_open_id", sellerOpenId)
    .maybeSingle();
  if (!row?.access_token_enc || !row?.refresh_token_enc) return null;

  const tokenRow = row as TokenRow;
  const expiresAtMs = tokenRow.access_token_expires_at
    ? new Date(String(tokenRow.access_token_expires_at)).getTime()
    : null;
  const needsRefresh = expiresAtMs != null &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs < Date.now() + 60_000;

  if (!needsRefresh) {
    try {
      return await decryptTikTokShopToken(String(tokenRow.access_token_enc));
    } catch (e) {
      console.error("getTikTokShopAccessToken decrypt:", e);
    }
  }

  let refreshToken: string;
  try {
    refreshToken = await decryptTikTokShopToken(String(tokenRow.refresh_token_enc));
  } catch (e) {
    console.error("getTikTokShopAccessToken refresh decrypt:", e);
    return null;
  }

  const oauth = readPlatformTikTokShopOAuth();
  const refreshed = oauth ? await refreshTikTokShopAccessToken(oauth, refreshToken) : null;

  if (!refreshed?.access_token) {
    try {
      return await decryptTikTokShopToken(String(tokenRow.access_token_enc));
    } catch {
      return null;
    }
  }

  try {
    const now = new Date().toISOString();
    const accessEnc = await encryptTikTokShopToken(refreshed.access_token);
    const refreshEnc = refreshed.refresh_token
      ? await encryptTikTokShopToken(refreshed.refresh_token)
      : String(tokenRow.refresh_token_enc);
    const accessExpires = tokenExpiresAtIsoFromTikTokField(refreshed.access_token_expire_in)
      ?? tokenRow.access_token_expires_at;
    const refreshExpires = tokenExpiresAtIsoFromTikTokField(refreshed.refresh_token_expire_in);

    await admin.from("organization_tiktok_shop_connection_tokens").update({
      access_token_enc: accessEnc,
      refresh_token_enc: refreshEnc,
      access_token_expires_at: accessExpires,
      refresh_token_expires_at: refreshExpires,
      seller_name: refreshed.seller_name ?? tokenRow.seller_name,
      seller_base_region: refreshed.seller_base_region ?? tokenRow.seller_base_region,
      updated_at: now,
    }).eq("organization_id", organizationId).eq("seller_open_id", sellerOpenId);

    return refreshed.access_token;
  } catch (e) {
    console.error("getTikTokShopAccessToken re-encrypt:", e);
    return refreshed.access_token;
  }
}

export async function listTikTokShopSellerOpenIds(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const { data } = await admin
    .from("organization_tiktok_shop_connection_tokens")
    .select("seller_open_id")
    .eq("organization_id", organizationId);
  return (data ?? []).map((r) => String((r as { seller_open_id: string }).seller_open_id));
}

export async function resolveDefaultShopAccount(
  admin: SupabaseClient,
  organizationId: string,
): Promise<TikTokShopAccountRow | null> {
  const { data: defaultRow } = await admin
    .from("organization_tiktok_shop_accounts")
    .select(
      "id, organization_id, seller_open_id, shop_id, shop_cipher, shop_name, region, seller_type, label, is_default, is_active, sort_order",
    )
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();
  if (defaultRow) return defaultRow as TikTokShopAccountRow;

  const { data: first } = await admin
    .from("organization_tiktok_shop_accounts")
    .select(
      "id, organization_id, seller_open_id, shop_id, shop_cipher, shop_name, region, seller_type, label, is_default, is_active, sort_order",
    )
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (first as TikTokShopAccountRow | null) ?? null;
}

export async function syncTikTokShopAccountsForSeller(
  admin: SupabaseClient,
  organizationId: string,
  sellerOpenId: string,
  shops: TikTokShopAuthorizedShop[],
): Promise<{ upserted: number; isExistingSeller: boolean }> {
  const sellerId = sellerOpenId.trim();
  const { data: existingShops } = await admin
    .from("organization_tiktok_shop_accounts")
    .select("id, shop_id, is_default")
    .eq("organization_id", organizationId)
    .eq("seller_open_id", sellerId);

  const existingSellerShopIds = new Set(
    (existingShops ?? []).map((r) => String((r as { shop_id: string }).shop_id)),
  );
  const isExistingSeller = existingSellerShopIds.size > 0;

  const { data: allActiveShops } = await admin
    .from("organization_tiktok_shop_accounts")
    .select("is_default")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  const orgHasDefault = (allActiveShops ?? []).some(
    (r) => Boolean((r as { is_default?: boolean }).is_default),
  );

  const now = new Date().toISOString();
  let upserted = 0;
  let firstNewInBatch = !orgHasDefault;

  for (const shop of shops) {
    const shopId = shop.shop_id.trim();
    if (!shopId) continue;
    const isExistingShop = existingSellerShopIds.has(shopId);
    const existingDefault = (existingShops ?? []).find(
      (r) => String((r as { shop_id: string }).shop_id) === shopId,
    ) as { is_default?: boolean } | undefined;

    const { error } = await admin.from("organization_tiktok_shop_accounts").upsert(
      {
        organization_id: organizationId,
        seller_open_id: sellerId,
        shop_id: shopId,
        shop_cipher: shop.shop_cipher,
        shop_name: shop.shop_name,
        region: shop.region ?? null,
        seller_type: shop.seller_type ?? null,
        label: shop.shop_name || shopId,
        is_default: isExistingShop
          ? Boolean(existingDefault?.is_default)
          : firstNewInBatch,
        is_active: true,
        updated_at: now,
      },
      { onConflict: "organization_id,shop_id" },
    );
    if (!error) {
      upserted++;
      if (!isExistingShop && firstNewInBatch) firstNewInBatch = false;
    } else {
      console.error("syncTikTokShopAccountsForSeller upsert:", error.message);
    }
  }

  return { upserted, isExistingSeller };
}

export async function resolveOrgTikTokShopForOrders(
  admin: SupabaseClient,
  organizationId: string,
  shopAccountIdOrShopId: string | null,
): Promise<{ accessToken: string; account: TikTokShopAccountRow } | null> {
  const param = shopAccountIdOrShopId?.trim() ?? "";
  let account: TikTokShopAccountRow | null = null;

  if (param) {
    const { data: byId } = await admin
      .from("organization_tiktok_shop_accounts")
      .select(
        "id, organization_id, seller_open_id, shop_id, shop_cipher, shop_name, region, seller_type, label, is_default, is_active, sort_order",
      )
      .eq("organization_id", organizationId)
      .eq("id", param)
      .eq("is_active", true)
      .maybeSingle();
    if (byId) {
      account = byId as TikTokShopAccountRow;
    } else {
      const { data: byShopId } = await admin
        .from("organization_tiktok_shop_accounts")
        .select(
          "id, organization_id, seller_open_id, shop_id, shop_cipher, shop_name, region, seller_type, label, is_default, is_active, sort_order",
        )
        .eq("organization_id", organizationId)
        .eq("shop_id", param)
        .eq("is_active", true)
        .maybeSingle();
      account = (byShopId as TikTokShopAccountRow | null) ?? null;
    }
  }

  if (!account) {
    account = await resolveDefaultShopAccount(admin, organizationId);
  }
  if (!account?.shop_cipher || !account.seller_open_id) return null;

  const accessToken = await getTikTokShopAccessToken(
    admin,
    organizationId,
    account.seller_open_id,
  );
  if (!accessToken) return null;

  return { accessToken, account };
}

export async function fetchAndSyncAuthorizedShops(
  admin: SupabaseClient,
  organizationId: string,
  sellerOpenId: string,
): Promise<TikTokShopAuthorizedShop[]> {
  const oauth = readPlatformTikTokShopOAuth();
  if (!oauth) throw new Error("Platform not configured");

  const accessToken = await getTikTokShopAccessToken(admin, organizationId, sellerOpenId);
  if (!accessToken) throw new Error("Seller not connected");

  const shops = await getTikTokShopAuthorizedShops(oauth, accessToken);
  await syncTikTokShopAccountsForSeller(admin, organizationId, sellerOpenId, shops);
  return shops;
}
