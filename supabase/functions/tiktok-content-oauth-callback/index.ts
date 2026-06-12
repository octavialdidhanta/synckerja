/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptTikTokContentToken } from "../_shared/tiktokContentConfigCrypto.ts";
import {
  mergeTikTokContentOAuthScopes,
  TIKTOK_CONTENT_OAUTH_SCOPES,
  TIKTOK_CONTENT_OAUTH_RETURN_PATHS,
  TIKTOK_CONTENT_OAUTH_TOKEN_KINDS,
  appPublicOrigin,
  readPlatformTikTokContentOAuth,
  tiktokContentOAuthRedirectUri,
} from "../_shared/tiktokContentAuth.ts";
import { exchangeTikTokBusinessOrganicAuthCode, fetchTikTokUserInfo } from "../_shared/tiktokContentApi.ts";
import { isPlaceholderTikTokAccountLabel } from "../_shared/tiktokContentAccountProfile.ts";

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
  if (path && TIKTOK_CONTENT_OAUTH_RETURN_PATHS.has(path)) return path;
  return "/digital-marketing/social-media-performance/tiktok/settings";
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

  const oauth = readPlatformTikTokContentOAuth();
  if (!oauth) {
    return redirectDefault("?oauth_error=oauth_not_configured");
  }

  const redirectUri = tiktokContentOAuthRedirectUri();
  const tokenKind = TIKTOK_CONTENT_OAUTH_TOKEN_KINDS.ttUser;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectDefault("?oauth_error=server_misconfigured");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Exchange auth code immediately (parallel with state lookup) — codes expire in seconds.
  const [stateRes, tokenResult] = await Promise.all([
    admin
      .from("tiktok_content_oauth_states")
      .select("id, organization_id, user_id, expires_at, return_path")
      .eq("state_token", state)
      .maybeSingle(),
    exchangeTikTokBusinessOrganicAuthCode(
      oauth.clientKey,
      oauth.clientSecret,
      authCode,
      redirectUri,
    ).then(
      (data) => ({ ok: true as const, data }),
      (e) => ({ ok: false as const, error: e }),
    ),
  ]);

  const stateRow = stateRes.data as OAuthStateRow | null;
  const oauthReturnPath = resolveOAuthReturnPath(
    stateRow?.return_path != null ? String(stateRow.return_path) : null,
  );

  if (!tokenResult.ok) {
    const msg = sanitizeOAuthError(
      tokenResult.error instanceof Error ? tokenResult.error.message : "token_exchange_failed",
    );
    console.error("tiktok-content-oauth-callback:", msg);
    return redirectDefault(`?oauth_error=${encodeURIComponent(msg)}`, oauthReturnPath);
  }

  const tokenData = tokenResult.data;

  if (stateRes.error || !stateRow?.id) {
    return redirectDefault("?oauth_error=invalid_state", oauthReturnPath);
  }

  const expiresAt = new Date(String(stateRow.expires_at)).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    await admin.from("tiktok_content_oauth_states").delete().eq("id", stateRow.id);
    return redirectDefault("?oauth_error=state_expired", oauthReturnPath);
  }

  await admin.from("tiktok_content_oauth_states").delete().eq("id", stateRow.id);

  const organizationId = String(stateRow.organization_id);
  const openId = tokenData.open_id;

  let accessEnc: string;
  let refreshEnc: string;
  try {
    accessEnc = await encryptTikTokContentToken(tokenData.access_token);
    refreshEnc = await encryptTikTokContentToken(tokenData.refresh_token);
  } catch (e) {
    console.error("tiktok-content-oauth-callback encrypt:", e);
    return redirectDefault("?oauth_error=encryption_failed", oauthReturnPath);
  }

  const now = new Date().toISOString();
  const accessExpires = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;
  const refreshExpires = tokenData.refresh_expires_in
    ? new Date(Date.now() + tokenData.refresh_expires_in * 1000).toISOString()
    : null;

  let displayName = "";
  let avatarUrl: string | null = null;
  try {
    const userInfo = await fetchTikTokUserInfo(tokenData.access_token);
    displayName = userInfo.display_name?.trim() ?? "";
    avatarUrl = userInfo.avatar_url?.trim() || null;
  } catch (e) {
    console.warn(
      "tiktok-content-oauth-callback userInfo:",
      e instanceof Error ? e.message : e,
    );
  }
  if (!displayName || isPlaceholderTikTokAccountLabel(displayName, openId)) {
    displayName = `TikTok ${openId.slice(0, 8)}`;
  }

  const { error: connErr } = await admin.from("organization_tiktok_content_connections").upsert(
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
    console.error("tiktok-content-oauth-callback connection:", connErr.message);
    return redirectDefault("?oauth_error=save_connection_failed", oauthReturnPath);
  }

  const { error: tokErr } = await admin.from("organization_tiktok_content_connection_tokens").upsert(
    {
      organization_id: organizationId,
      open_id: openId,
      access_token_enc: accessEnc,
      refresh_token_enc: refreshEnc,
      access_token_expires_at: accessExpires,
      refresh_token_expires_at: refreshExpires,
      oauth_scopes: mergeTikTokContentOAuthScopes(tokenData.scope, TIKTOK_CONTENT_OAUTH_SCOPES),
      oauth_token_kind: tokenKind,
      updated_at: now,
    },
    { onConflict: "organization_id,open_id" },
  );
  if (tokErr) {
    console.error("tiktok-content-oauth-callback token:", tokErr.message);
    return redirectDefault("?oauth_error=save_token_failed", oauthReturnPath);
  }

  const { data: existingAccounts } = await admin
    .from("organization_tiktok_content_accounts")
    .select("id, is_default, open_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  const hasDefault = (existingAccounts ?? []).some(
    (a) => Boolean((a as { is_default?: boolean }).is_default),
  );
  const existingOpenId = (existingAccounts ?? []).find(
    (a) => String((a as { open_id?: string }).open_id) === openId,
  );
  const isExistingAccount = Boolean(existingOpenId);

  const { error: accErr } = await admin.from("organization_tiktok_content_accounts").upsert(
    {
      organization_id: organizationId,
      open_id: openId,
      label: displayName,
      display_name: displayName,
      avatar_url: avatarUrl,
      is_default: existingOpenId
        ? Boolean((existingOpenId as { is_default?: boolean }).is_default)
        : !hasDefault,
      is_active: true,
      updated_at: now,
    },
    { onConflict: "organization_id,open_id" },
  );
  if (accErr) {
    console.error("tiktok-content-oauth-callback account:", accErr.message);
    return redirectDefault("?oauth_error=save_account_failed", oauthReturnPath);
  }

  const query = isExistingAccount ? "?connected=1&existing=1" : "?connected=1";
  return redirectDefault(query, oauthReturnPath);
});
