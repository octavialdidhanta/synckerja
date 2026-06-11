/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptLinkedInContentToken } from "../_shared/linkedinContentConfigCrypto.ts";
import { saveLinkedInPageConnection } from "../_shared/linkedinContentConnectionSave.ts";
import {
  LINKEDIN_CONTENT_OAUTH_RETURN_PATHS,
  appPublicOrigin,
  readPlatformLinkedInContentOAuth,
  linkedinContentOAuthRedirectUri,
} from "../_shared/linkedinContentAuth.ts";
import {
  exchangeLinkedInContentAuthCode,
  fetchLinkedInAdministeredPages,
} from "../_shared/linkedinContentApi.ts";

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
  if (path && LINKEDIN_CONTENT_OAUTH_RETURN_PATHS.has(path)) return path;
  return "/digital-marketing/social-media-performance/linkedin/settings";
}

function sanitizeOAuthError(msg: string): string {
  const trimmed = msg.trim();
  if (!trimmed || trimmed === "OK" || trimmed === "ok") return "token_exchange_failed";
  return trimmed;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const authCode = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error")?.trim() ?? "";

  const redirectDefault = (query: string, returnPath?: string | null) =>
    redirectToAppPath(resolveOAuthReturnPath(returnPath), query);

  if (oauthError) {
    const errorDesc = url.searchParams.get("error_description")?.trim() ?? "";
    const query = new URLSearchParams({ oauth_error: oauthError });
    if (errorDesc) query.set("oauth_error_desc", errorDesc);
    return redirectDefault(`?${query.toString()}`);
  }
  if (!authCode || !state) {
    return redirectDefault("?oauth_error=missing_code_or_state");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectDefault("?oauth_error=server_misconfigured");
  }

  const oauth = readPlatformLinkedInContentOAuth();
  if (!oauth) {
    return redirectDefault("?oauth_error=oauth_not_configured");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: stateRow, error: stateErr } = await admin
    .from("linkedin_content_oauth_states")
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
    await admin.from("linkedin_content_oauth_states").delete().eq("id", stateRow.id);
    return redirectDefault("?oauth_error=state_expired", oauthReturnPath);
  }

  await admin.from("linkedin_content_oauth_states").delete().eq("id", stateRow.id);

  const redirectUri = linkedinContentOAuthRedirectUri();
  let tokenData;
  try {
    tokenData = await exchangeLinkedInContentAuthCode(
      oauth.clientId,
      oauth.clientSecret,
      authCode,
      redirectUri,
    );
  } catch (e) {
    const msg = sanitizeOAuthError(e instanceof Error ? e.message : "token_exchange_failed");
    console.error("linkedin-content-oauth-callback:", msg);
    return redirectDefault(`?oauth_error=${encodeURIComponent(msg)}`, oauthReturnPath);
  }

  const organizationId = String(stateRow.organization_id);
  const userId = String(stateRow.user_id);

  let pages;
  try {
    pages = await fetchLinkedInAdministeredPages(tokenData.access_token);
  } catch (e) {
    const msg = sanitizeOAuthError(e instanceof Error ? e.message : "pages_list_failed");
    console.error("linkedin-content-oauth-callback pages:", msg);
    return redirectDefault(`?oauth_error=${encodeURIComponent(msg)}`, oauthReturnPath);
  }

  if (pages.length === 0) {
    return redirectDefault("?oauth_error=no_linkedin_pages", oauthReturnPath);
  }

  if (pages.length === 1) {
    try {
      const { isExistingAccount } = await saveLinkedInPageConnection(admin, {
        organizationId,
        userId,
        page: pages[0],
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      });
      const query = isExistingAccount ? "?connected=1&existing=1" : "?connected=1";
      return redirectDefault(query, oauthReturnPath);
    } catch (e) {
      console.error("linkedin-content-oauth-callback save:", e);
      return redirectDefault("?oauth_error=save_connection_failed", oauthReturnPath);
    }
  }

  const pendingExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  let accessEnc: string;
  let refreshEnc: string;
  try {
    accessEnc = await encryptLinkedInContentToken(tokenData.access_token);
    refreshEnc = await encryptLinkedInContentToken(tokenData.refresh_token);
  } catch (e) {
    console.error("linkedin-content-oauth-callback encrypt:", e);
    return redirectDefault("?oauth_error=encryption_failed", oauthReturnPath);
  }

  await admin.from("linkedin_content_pending_connections")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  const accessExpires = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const { error: pendingErr } = await admin.from("linkedin_content_pending_connections").insert({
    organization_id: organizationId,
    user_id: userId,
    access_token_enc: accessEnc,
    refresh_token_enc: refreshEnc,
    access_token_expires_at: accessExpires,
    pages_json: pages,
    expires_at: pendingExpires,
  });

  if (pendingErr) {
    console.error("linkedin-content-oauth-callback pending:", pendingErr.message);
    return redirectDefault("?oauth_error=save_pending_failed", oauthReturnPath);
  }

  return redirectDefault("?select_page=1", oauthReturnPath);
});
