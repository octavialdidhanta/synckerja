/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  appPublicOrigin,
  ensureOrgRootFolder,
  isOrgOwnerOrAdmin,
  ORG_DRIVE_OAUTH_SCOPES,
  ORG_DRIVE_SETTINGS_PATH,
  ORG_DRIVE_SETTINGS_SECTION,
  orgDriveOAuthRedirectUri,
  readGoogleOAuthClient,
} from "../_shared/orgDrive/access.ts";
import { encryptOrgDriveToken } from "../_shared/orgDrive/crypto.ts";

function back(query: Record<string, string>): Response {
  const origin = appPublicOrigin() || "http://localhost:8080";
  const params = new URLSearchParams({ section: ORG_DRIVE_SETTINGS_SECTION, ...query });
  return new Response(null, { status: 302, headers: { Location: `${origin}${ORG_DRIVE_SETTINGS_PATH}?${params.toString()}` } });
}

async function fetchEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { email?: string };
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error")?.trim() ?? "";

  if (oauthError) return back({ drive_oauth_error: oauthError.slice(0, 120) });
  if (!code || !state) return back({ drive_oauth_error: "missing_code_or_state" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const client = readGoogleOAuthClient();
  if (!supabaseUrl || !serviceRoleKey || !client) return back({ drive_oauth_error: "server_misconfigured" });

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: stateRow } = await admin
    .from("google_drive_org_oauth_states")
    .select("id, organization_id, user_id, code_verifier, expires_at")
    .eq("state_token", state)
    .maybeSingle();
  if (!stateRow?.id) return back({ drive_oauth_error: "invalid_state" });
  // One-time use.
  await admin.from("google_drive_org_oauth_states").delete().eq("id", stateRow.id);
  if (new Date(String(stateRow.expires_at)).getTime() < Date.now()) return back({ drive_oauth_error: "state_expired" });

  const organizationId = String(stateRow.organization_id);
  const userId = String(stateRow.user_id);
  // Role may have changed during the 15-minute window.
  if (!(await isOrgOwnerOrAdmin(admin, userId, organizationId))) return back({ drive_oauth_error: "forbidden" });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: orgDriveOAuthRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: String(stateRow.code_verifier),
    }).toString(),
  });
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
    refresh_token?: string;
    access_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
  };
  if (!tokenRes.ok || !tokenJson.refresh_token || !tokenJson.access_token) {
    console.error("google-drive-org-oauth-callback: token exchange", tokenJson.error ?? tokenRes.status);
    return back({ drive_oauth_error: tokenJson.error ?? "token_exchange_failed" });
  }
  const granted = String(tokenJson.scope ?? "");
  if (!granted.includes("https://www.googleapis.com/auth/drive.file")) {
    return back({ drive_oauth_error: "drive_permission_not_granted" });
  }

  const now = new Date().toISOString();
  const email = await fetchEmail(tokenJson.access_token);
  try {
    const { error: tokErr } = await admin.from("organization_google_drive_connection_tokens").upsert(
      {
        organization_id: organizationId,
        refresh_token_enc: await encryptOrgDriveToken(tokenJson.refresh_token),
        access_token_enc: await encryptOrgDriveToken(tokenJson.access_token),
        access_token_expires_at: new Date(Date.now() + Math.max(60, Number(tokenJson.expires_in ?? 3600)) * 1000).toISOString(),
        oauth_scopes: granted || ORG_DRIVE_OAUTH_SCOPES,
        updated_at: now,
      },
      { onConflict: "organization_id" },
    );
    if (tokErr) throw new Error(tokErr.message);
  } catch (e) {
    console.error("google-drive-org-oauth-callback: save token", (e as Error).message);
    return back({ drive_oauth_error: "save_token_failed" });
  }

  const { error: connErr } = await admin.from("organization_google_drive_connections").upsert(
    {
      organization_id: organizationId,
      google_account_email: email,
      is_active: true,
      // New account = new root folder, found or created below.
      root_folder_id: null,
      oauth_connected_at: now,
      connected_by: userId,
      last_error: null,
      updated_at: now,
    },
    { onConflict: "organization_id" },
  );
  if (connErr) {
    console.error("google-drive-org-oauth-callback: save connection", connErr.message);
    return back({ drive_oauth_error: "save_connection_failed" });
  }

  try {
    await ensureOrgRootFolder(admin, organizationId, tokenJson.access_token, null);
  } catch (e) {
    // Not fatal: the first upload creates it.
    console.warn("google-drive-org-oauth-callback: root folder", (e as Error).message);
  }

  return back({ drive_connected: "1" });
});
