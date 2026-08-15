/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptMetaAdsAccessToken } from "../_shared/metaAdsConfigCrypto.ts";
import {
  META_ADS_OAUTH_RETURN_PATHS,
  appPublicOrigin,
  exchangeMetaLongLivedToken,
  metaAdsOAuthRedirectUri,
  metaGraphVersion,
  readPlatformMetaAdsOAuth,
} from "../_shared/metaAdsAuth.ts";

function withSharedPlatformQuery(query: string, returnPath: string): string {
  const shared =
    returnPath === "/omnichannel/settings/offline-conversion" ||
    returnPath === "/omnichannel/settings/google-ads";
  if (!shared) return query;
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  params.set("platform", "meta");
  return `?${params.toString()}`;
}

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
  if (path && META_ADS_OAUTH_RETURN_PATHS.has(path)) return path;
  return "/omnichannel/settings/offline-conversion";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error")?.trim() ?? "";

  const redirectDefault = (query: string, returnPath?: string | null) => {
    const path = resolveOAuthReturnPath(returnPath);
    return redirectToAppPath(path, withSharedPlatformQuery(query, path));
  };

  if (oauthError) {
    return redirectDefault(`?oauth_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return redirectDefault("?oauth_error=missing_code_or_state");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectDefault("?oauth_error=server_misconfigured");
  }

  const oauth = readPlatformMetaAdsOAuth();
  if (!oauth) {
    return redirectDefault("?oauth_error=oauth_not_configured");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: stateRow, error: stateErr } = await admin
    .from("meta_ads_oauth_states")
    .select("id, organization_id, user_id, code_verifier, expires_at, return_path")
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
    await admin.from("meta_ads_oauth_states").delete().eq("id", stateRow.id);
    return redirectDefault("?oauth_error=state_expired", oauthReturnPath);
  }

  const redirectUri = metaAdsOAuthRedirectUri();
  const v = metaGraphVersion();
  const tokenParams = new URLSearchParams({
    client_id: oauth.appId,
    client_secret: oauth.appSecret,
    redirect_uri: redirectUri,
    code,
    code_verifier: String(stateRow.code_verifier),
  });

  const tokenRes = await fetch(
    `https://graph.facebook.com/${v}/oauth/access_token?${tokenParams.toString()}`,
    { method: "GET" },
  );
  const tokenJson = await tokenRes.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string; type?: string };
  };

  await admin.from("meta_ads_oauth_states").delete().eq("id", stateRow.id);

  if (!tokenRes.ok || !tokenJson.access_token) {
    const msg = tokenJson.error?.message ?? "token_exchange_failed";
    console.error("meta-ads-oauth-callback:", msg);
    return redirectDefault(`?oauth_error=${encodeURIComponent(msg)}`, oauthReturnPath);
  }

  const longLived = await exchangeMetaLongLivedToken(
    tokenJson.access_token,
    oauth.appId,
    oauth.appSecret,
  );

  let metaUserId: string | null = null;
  try {
    const meRes = await fetch(
      `https://graph.facebook.com/${v}/me?fields=id&access_token=${encodeURIComponent(longLived)}`,
    );
    const meJson = await meRes.json().catch(() => ({})) as { id?: string };
    if (meJson.id) metaUserId = String(meJson.id);
  } catch {
    /* optional */
  }

  const organizationId = String(stateRow.organization_id);
  let accessEnc: string;
  try {
    accessEnc = await encryptMetaAdsAccessToken(longLived);
  } catch (e) {
    console.error("meta-ads-oauth-callback encrypt:", e);
    return redirectDefault("?oauth_error=encryption_failed", oauthReturnPath);
  }

  const now = new Date().toISOString();
  const expiresInSec = tokenJson.expires_in ?? 60 * 24 * 60 * 60;
  const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

  const { error: connErr } = await admin.from("organization_meta_ads_connections").upsert(
    {
      organization_id: organizationId,
      oauth_connected_at: now,
      meta_user_id: metaUserId,
      updated_at: now,
      created_by: stateRow.user_id,
    },
    { onConflict: "organization_id" },
  );
  if (connErr) {
    console.error("meta-ads-oauth-callback connection:", connErr.message);
    return redirectDefault("?oauth_error=save_connection_failed", oauthReturnPath);
  }

  const { error: tokErr } = await admin.from("organization_meta_ads_connection_tokens").upsert(
    {
      organization_id: organizationId,
      access_token_enc: accessEnc,
      token_expires_at: tokenExpiresAt,
      updated_at: now,
    },
    { onConflict: "organization_id" },
  );
  if (tokErr) {
    console.error("meta-ads-oauth-callback token:", tokErr.message);
    return redirectDefault("?oauth_error=save_token_failed", oauthReturnPath);
  }

  return redirectDefault("?connected=1", oauthReturnPath);
});
