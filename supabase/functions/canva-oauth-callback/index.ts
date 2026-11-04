/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CANVA_OAUTH_SCOPES,
  CANVA_SETTINGS_PATH,
  canvaAppPublicOrigin,
  readPlatformCanvaOAuth,
} from "../_shared/canvaAuth.ts";
import { encryptCanvaToken } from "../_shared/canvaConfigCrypto.ts";
import { fetchCanvaIdentity } from "../_shared/canvaProfile.ts";
import { exchangeCanvaAuthorizationCode } from "../_shared/canvaToken.ts";

function redirectToSettings(query: Record<string, string>, status = 302): Response {
  const origin = canvaAppPublicOrigin() || "http://localhost:8080";
  const params = new URLSearchParams({ section: "canva", ...query });
  return new Response(null, {
    status,
    headers: { Location: `${origin}${CANVA_SETTINGS_PATH}?${params.toString()}` },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error")?.trim() ?? "";

  if (oauthError) {
    return redirectToSettings({ canva_oauth_error: oauthError.slice(0, 180) });
  }
  if (!code || !state) {
    return redirectToSettings({ canva_oauth_error: "missing_code_or_state" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectToSettings({ canva_oauth_error: "server_misconfigured" });
  }
  if (!readPlatformCanvaOAuth()) {
    return redirectToSettings({ canva_oauth_error: "oauth_not_configured" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: stateRow, error: stateErr } = await admin
    .from("canva_oauth_states")
    .select("id, organization_id, user_id, code_verifier, expires_at")
    .eq("state_token", state)
    .maybeSingle();

  if (stateErr || !stateRow?.id) {
    return redirectToSettings({ canva_oauth_error: "invalid_state" });
  }

  const expiresAt = new Date(String(stateRow.expires_at)).getTime();
  await admin.from("canva_oauth_states").delete().eq("id", stateRow.id);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return redirectToSettings({ canva_oauth_error: "state_expired" });
  }

  let tokenJson;
  try {
    tokenJson = await exchangeCanvaAuthorizationCode(code, String(stateRow.code_verifier));
  } catch (error) {
    console.error("canva-oauth-callback exchange:", error instanceof Error ? error.message : "failed");
    return redirectToSettings({ canva_oauth_error: "token_exchange_failed" });
  }

  if (!tokenJson.access_token || !tokenJson.refresh_token) {
    const message = (tokenJson.message || tokenJson.code || "token_exchange_failed").slice(0, 180);
    return redirectToSettings({ canva_oauth_error: message });
  }

  let refreshEnc: string;
  let accessEnc: string;
  try {
    refreshEnc = await encryptCanvaToken(tokenJson.refresh_token);
    accessEnc = await encryptCanvaToken(tokenJson.access_token);
  } catch (error) {
    console.error("canva-oauth-callback encrypt:", error instanceof Error ? error.message : "failed");
    return redirectToSettings({ canva_oauth_error: "encryption_failed" });
  }

  let identity = { userId: null as string | null, teamId: null as string | null, displayName: null as string | null };
  try {
    identity = await fetchCanvaIdentity(tokenJson.access_token);
  } catch {
    identity = { userId: null, teamId: null, displayName: null };
  }

  const organizationId = String(stateRow.organization_id);
  const now = new Date().toISOString();
  const expiresInSec = Number(tokenJson.expires_in ?? 14400);
  const { error: connErr } = await admin.from("organization_canva_connections").upsert(
    {
      organization_id: organizationId,
      canva_user_id: identity.userId,
      canva_team_id: identity.teamId,
      display_name: identity.displayName,
      is_active: true,
      oauth_connected_at: now,
      connected_by: stateRow.user_id,
      last_error: null,
      updated_at: now,
    },
    { onConflict: "organization_id" },
  );
  if (connErr) {
    console.error("canva-oauth-callback connection:", connErr.message);
    return redirectToSettings({ canva_oauth_error: "save_connection_failed" });
  }

  const { error: tokErr } = await admin.from("organization_canva_connection_tokens").upsert(
    {
      organization_id: organizationId,
      refresh_token_enc: refreshEnc,
      access_token_enc: accessEnc,
      access_token_expires_at: new Date(Date.now() + Math.max(60, expiresInSec) * 1000).toISOString(),
      oauth_scopes: tokenJson.scope ?? CANVA_OAUTH_SCOPES,
      updated_at: now,
    },
    { onConflict: "organization_id" },
  );
  if (tokErr) {
    console.error("canva-oauth-callback token:", tokErr.message);
    return redirectToSettings({ canva_oauth_error: "save_token_failed" });
  }

  return redirectToSettings({ canva_connected: "1" });
});
