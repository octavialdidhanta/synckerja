/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptGoogleAdsRefreshToken } from "../_shared/googleAdsConfigCrypto.ts";
import {
  appPublicOrigin,
  googleAdsOAuthRedirectUri,
  readPlatformGoogleAdsOAuth,
} from "../_shared/googleAdsAuth.ts";

function redirectToAppPath(path: string, query: string, status = 302): Response {
  const origin = appPublicOrigin() || "http://localhost:5173";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const target = `${origin}${normalizedPath}${query}`;
  return new Response(null, {
    status,
    headers: { Location: target },
  });
}

const ALLOWED_OAUTH_RETURN_PATHS = new Set([
  "/omnichannel/settings/google-ads",
  "/digital-marketing/google-ads/settings",
]);

function resolveOAuthReturnPath(stored: string | null | undefined): string {
  const path = String(stored ?? "").trim();
  if (path && ALLOWED_OAUTH_RETURN_PATHS.has(path)) return path;
  return "/omnichannel/settings/google-ads";
}

function redirectToSettings(query: string, returnPath?: string | null, status = 302): Response {
  return redirectToAppPath(resolveOAuthReturnPath(returnPath), query, status);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error")?.trim() ?? "";

  if (oauthError) {
    return redirectToSettings(`?oauth_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return redirectToSettings("?oauth_error=missing_code_or_state");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectToSettings("?oauth_error=server_misconfigured");
  }

  const oauth = readPlatformGoogleAdsOAuth();
  if (!oauth) {
    return redirectToSettings("?oauth_error=oauth_not_configured");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: stateRow, error: stateErr } = await admin
    .from("google_ads_oauth_states")
    .select("id, organization_id, user_id, code_verifier, expires_at, return_path")
    .eq("state_token", state)
    .maybeSingle();

  const oauthReturnPath = resolveOAuthReturnPath(
    stateRow?.return_path != null ? String(stateRow.return_path) : null,
  );

  if (stateErr || !stateRow?.id) {
    return redirectToSettings("?oauth_error=invalid_state", oauthReturnPath);
  }

  const expiresAt = new Date(String(stateRow.expires_at)).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    await admin.from("google_ads_oauth_states").delete().eq("id", stateRow.id);
    return redirectToSettings("?oauth_error=state_expired", oauthReturnPath);
  }

  const redirectUri = googleAdsOAuthRedirectUri();
  const tokenBody = new URLSearchParams({
    code,
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: String(stateRow.code_verifier),
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });
  const tokenJson = (await tokenRes.json()) as {
    refresh_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  await admin.from("google_ads_oauth_states").delete().eq("id", stateRow.id);

  if (!tokenRes.ok || !tokenJson.refresh_token) {
    const msg = tokenJson.error_description ?? tokenJson.error ?? "token_exchange_failed";
    console.error("google-ads-oauth-callback:", msg);
    return redirectToSettings(`?oauth_error=${encodeURIComponent(msg)}`, oauthReturnPath);
  }

  const organizationId = String(stateRow.organization_id);
  let refreshEnc: string;
  try {
    refreshEnc = await encryptGoogleAdsRefreshToken(tokenJson.refresh_token);
  } catch (e) {
    console.error("google-ads-oauth-callback encrypt:", e);
    return redirectToSettings("?oauth_error=encryption_failed", oauthReturnPath);
  }

  const now = new Date().toISOString();
  const { error: connErr } = await admin.from("organization_google_ads_connections").upsert(
    {
      organization_id: organizationId,
      oauth_connected_at: now,
      updated_at: now,
      created_by: stateRow.user_id,
    },
    { onConflict: "organization_id" },
  );
  if (connErr) {
    console.error("google-ads-oauth-callback connection:", connErr.message);
    return redirectToSettings("?oauth_error=save_connection_failed", oauthReturnPath);
  }

  const { error: tokErr } = await admin.from("organization_google_ads_connection_tokens").upsert(
    {
      organization_id: organizationId,
      refresh_token_enc: refreshEnc,
      updated_at: now,
    },
    { onConflict: "organization_id" },
  );
  if (tokErr) {
    console.error("google-ads-oauth-callback token:", tokErr.message);
    return redirectToSettings("?oauth_error=save_token_failed", oauthReturnPath);
  }

  return redirectToSettings("?connected=1", oauthReturnPath);
});
