/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  encryptTikTokAdsToken,
} from "../_shared/tiktokAdsConfigCrypto.ts";
import {
  TIKTOK_ADS_OAUTH_RETURN_PATHS,
  appPublicOrigin,
  readPlatformTikTokAdsOAuth,
  tiktokAdsOAuthRedirectUri,
} from "../_shared/tiktokAdsAuth.ts";
import { exchangeTikTokAuthCode } from "../_shared/tiktokAdsApi.ts";

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
  if (path && TIKTOK_ADS_OAUTH_RETURN_PATHS.has(path)) return path;
  return "/digital-marketing/tiktok-ads/settings";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const authCode = url.searchParams.get("auth_code")?.trim() ??
    url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error")?.trim() ?? "";

  const redirectDefault = (query: string, returnPath?: string | null) =>
    redirectToAppPath(resolveOAuthReturnPath(returnPath), query);

  if (oauthError) {
    return redirectDefault(`?oauth_error=${encodeURIComponent(oauthError)}`);
  }
  if (!authCode || !state) {
    return redirectDefault("?oauth_error=missing_code_or_state");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectDefault("?oauth_error=server_misconfigured");
  }

  const oauth = readPlatformTikTokAdsOAuth();
  if (!oauth) {
    return redirectDefault("?oauth_error=oauth_not_configured");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: stateRow, error: stateErr } = await admin
    .from("tiktok_ads_oauth_states")
    .select("id, organization_id, user_id, expires_at, return_path")
    .eq("state_token", state)
    .maybeSingle();

  const oauthReturnPath = resolveOAuthReturnPath(
    stateRow?.return_path != null ? String(stateRow.return_path) : null,
  );

  if (stateErr || !stateRow?.id) {
    return redirectDefault("?oauth_error=invalid_state", oauthReturnPath);
  }

  const expiresAt = new Date(String(stateRow.expires_at)).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    await admin.from("tiktok_ads_oauth_states").delete().eq("id", stateRow.id);
    return redirectDefault("?oauth_error=state_expired", oauthReturnPath);
  }

  await admin.from("tiktok_ads_oauth_states").delete().eq("id", stateRow.id);

  let tokenData;
  try {
    tokenData = await exchangeTikTokAuthCode(oauth.appId, oauth.appSecret, authCode);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_exchange_failed";
    console.error("tiktok-ads-oauth-callback:", msg);
    return redirectDefault(`?oauth_error=${encodeURIComponent(msg)}`, oauthReturnPath);
  }

  const organizationId = String(stateRow.organization_id);
  let accessEnc: string;
  let refreshEnc: string;
  try {
    accessEnc = await encryptTikTokAdsToken(tokenData.access_token);
    refreshEnc = await encryptTikTokAdsToken(tokenData.refresh_token);
  } catch (e) {
    console.error("tiktok-ads-oauth-callback encrypt:", e);
    return redirectDefault("?oauth_error=encryption_failed", oauthReturnPath);
  }

  const now = new Date().toISOString();
  const accessExpires = tokenData.access_token_expires_in
    ? new Date(Date.now() + tokenData.access_token_expires_in * 1000).toISOString()
    : null;
  const refreshExpires = tokenData.refresh_token_expires_in
    ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000).toISOString()
    : null;

  const { error: connErr } = await admin.from("organization_tiktok_ads_connections").upsert(
    {
      organization_id: organizationId,
      oauth_connected_at: now,
      updated_at: now,
      created_by: stateRow.user_id,
    },
    { onConflict: "organization_id" },
  );
  if (connErr) {
    console.error("tiktok-ads-oauth-callback connection:", connErr.message);
    return redirectDefault("?oauth_error=save_connection_failed", oauthReturnPath);
  }

  const { error: tokErr } = await admin.from("organization_tiktok_ads_connection_tokens").upsert(
    {
      organization_id: organizationId,
      access_token_enc: accessEnc,
      refresh_token_enc: refreshEnc,
      access_token_expires_at: accessExpires,
      refresh_token_expires_at: refreshExpires,
      updated_at: now,
    },
    { onConflict: "organization_id" },
  );
  if (tokErr) {
    console.error("tiktok-ads-oauth-callback token:", tokErr.message);
    return redirectDefault("?oauth_error=save_token_failed", oauthReturnPath);
  }

  const advertiserIds = tokenData.advertiser_ids;
  if (advertiserIds.length > 0) {
    const { data: existing } = await admin
      .from("organization_tiktok_ads_accounts")
      .select("advertiser_id")
      .eq("organization_id", organizationId);
    const existingSet = new Set((existing ?? []).map((r) => String((r as { advertiser_id: string }).advertiser_id)));

    let sortOrder = 0;
    let hasDefault = (existing ?? []).length > 0;
    for (const advId of advertiserIds) {
      const digits = advId.replace(/\D/g, "");
      if (!digits || existingSet.has(digits)) continue;
      await admin.from("organization_tiktok_ads_accounts").insert({
        organization_id: organizationId,
        label: `Advertiser ${digits}`,
        advertiser_id: digits,
        is_default: !hasDefault,
        sort_order: sortOrder++,
        is_active: true,
      });
      hasDefault = true;
    }
  }

  return redirectDefault("?connected=1", oauthReturnPath);
});
