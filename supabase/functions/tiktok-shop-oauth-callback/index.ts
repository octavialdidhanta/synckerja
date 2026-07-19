/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptTikTokShopToken } from "../_shared/tiktokShopConfigCrypto.ts";
import {
  TIKTOK_SHOP_OAUTH_RETURN_PATHS,
  appPublicOrigin,
  readPlatformTikTokShopOAuth,
} from "../_shared/tiktokShopAuth.ts";
import {
  exchangeTikTokShopAuthCode,
  getTikTokShopAuthorizedShops,
  tokenExpiresAtIsoFromTikTokField,
} from "../_shared/tiktokShopApi.ts";
import { syncTikTokShopAccountsForSeller } from "../_shared/tiktokShopOrgResolver.ts";

function redirectToAppPath(path: string, query: string, status = 302): Response {
  const origin = appPublicOrigin() || "http://localhost:5173";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new Response(null, {
    status,
    headers: { Location: `${origin}${normalizedPath}${query}` },
  });
}

function resolveOAuthReturnPath(stored: string | null | undefined): string {
  const path = String(stored ?? "").trim();
  if (path && TIKTOK_SHOP_OAUTH_RETURN_PATHS.has(path)) return path;
  return "/operations/sales/tiktok-shop/settings";
}

function sanitizeOAuthError(msg: string): string {
  const trimmed = msg.trim();
  if (!trimmed || trimmed === "OK" || trimmed === "ok") return "token_exchange_failed";
  return trimmed;
}

type OAuthStateRow = {
  id: string;
  organization_id: string;
  user_id: string;
  expires_at: string;
  return_path?: string | null;
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const authCodeRaw = url.searchParams.get("auth_code")?.trim() ??
    url.searchParams.get("code")?.trim() ?? "";
  const authCode = authCodeRaw && authCodeRaw.toLowerCase() !== "null" ? authCodeRaw : "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error")?.trim() ?? "";

  const redirectDefault = (query: string, returnPath?: string | null) =>
    redirectToAppPath(resolveOAuthReturnPath(returnPath), query);

  // Seller denied authorization (code may be null).
  if (oauthError === "auth_denied" || oauthError.toLowerCase().includes("denied")) {
    return redirectDefault(`?oauth_error=${encodeURIComponent(oauthError || "auth_denied")}`);
  }
  if (oauthError) {
    return redirectDefault(`?oauth_error=${encodeURIComponent(oauthError)}`);
  }
  if (!authCode && !state) {
    return redirectDefault("?oauth_error=missing_code_or_state");
  }
  if (!authCode) {
    return redirectDefault("?oauth_error=auth_denied");
  }
  if (!state) {
    return redirectDefault("?oauth_error=missing_state");
  }

  const oauth = readPlatformTikTokShopOAuth();
  if (!oauth) {
    return redirectDefault("?oauth_error=oauth_not_configured");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectDefault("?oauth_error=server_misconfigured");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Validate CSRF state BEFORE exchanging auth_code (one-time, 30 min TTL at TikTok).
  const stateRes = await admin
    .from("tiktok_shop_oauth_states")
    .select("id, organization_id, user_id, expires_at, return_path")
    .eq("state_token", state)
    .maybeSingle();

  const stateRow = stateRes.data as OAuthStateRow | null;
  const oauthReturnPath = resolveOAuthReturnPath(
    stateRow?.return_path != null ? String(stateRow.return_path) : null,
  );

  if (stateRes.error || !stateRow?.id) {
    return redirectDefault("?oauth_error=invalid_state", oauthReturnPath);
  }

  const expiresAt = new Date(String(stateRow.expires_at)).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    await admin.from("tiktok_shop_oauth_states").delete().eq("id", stateRow.id);
    return redirectDefault("?oauth_error=state_expired", oauthReturnPath);
  }

  await admin.from("tiktok_shop_oauth_states").delete().eq("id", stateRow.id);

  let tokenData;
  try {
    tokenData = await exchangeTikTokShopAuthCode(oauth, authCode);
  } catch (e) {
    const msg = sanitizeOAuthError(e instanceof Error ? e.message : "token_exchange_failed");
    console.error("tiktok-shop-oauth-callback:", msg);
    return redirectDefault(`?oauth_error=${encodeURIComponent(msg)}`, oauthReturnPath);
  }

  const organizationId = String(stateRow.organization_id);
  const sellerOpenId = tokenData.seller_open_id;

  const { data: existingToken } = await admin
    .from("organization_tiktok_shop_connection_tokens")
    .select("seller_open_id")
    .eq("organization_id", organizationId)
    .eq("seller_open_id", sellerOpenId)
    .maybeSingle();
  const isExistingSeller = Boolean(existingToken?.seller_open_id);

  let accessEnc: string;
  let refreshEnc: string;
  try {
    accessEnc = await encryptTikTokShopToken(tokenData.access_token);
    refreshEnc = await encryptTikTokShopToken(tokenData.refresh_token);
  } catch (e) {
    console.error("tiktok-shop-oauth-callback encrypt:", e);
    return redirectDefault("?oauth_error=encryption_failed", oauthReturnPath);
  }

  const now = new Date().toISOString();
  const accessExpires = tokenExpiresAtIsoFromTikTokField(tokenData.access_token_expire_in);
  const refreshExpires = tokenExpiresAtIsoFromTikTokField(tokenData.refresh_token_expire_in);

  const { error: connErr } = await admin.from("organization_tiktok_shop_connections").upsert(
    {
      organization_id: organizationId,
      oauth_connected_at: now,
      is_active: true,
      updated_at: now,
      created_by: stateRow.user_id,
    },
    { onConflict: "organization_id" },
  );
  if (connErr) {
    console.error("tiktok-shop-oauth-callback connection:", connErr.message);
    return redirectDefault("?oauth_error=save_connection_failed", oauthReturnPath);
  }

  const { error: tokErr } = await admin.from("organization_tiktok_shop_connection_tokens").upsert(
    {
      organization_id: organizationId,
      seller_open_id: sellerOpenId,
      access_token_enc: accessEnc,
      refresh_token_enc: refreshEnc,
      access_token_expires_at: accessExpires,
      refresh_token_expires_at: refreshExpires,
      seller_name: tokenData.seller_name ?? null,
      seller_base_region: tokenData.seller_base_region ?? null,
      updated_at: now,
    },
    { onConflict: "organization_id,seller_open_id" },
  );
  if (tokErr) {
    console.error("tiktok-shop-oauth-callback token:", tokErr.message);
    return redirectDefault("?oauth_error=save_token_failed", oauthReturnPath);
  }

  try {
    const shops = await getTikTokShopAuthorizedShops(oauth, tokenData.access_token);
    await syncTikTokShopAccountsForSeller(admin, organizationId, sellerOpenId, shops);
  } catch (e) {
    console.warn(
      "tiktok-shop-oauth-callback authorized shops:",
      e instanceof Error ? e.message : e,
    );
  }

  const query = isExistingSeller ? "?connected=1&existing=1" : "?connected=1";
  return redirectDefault(query, oauthReturnPath);
});
