/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { completeBrickOAuthLink } from "../_shared/brick/brickConnectionService.ts";
import {
  redirectToAppPath,
  resolveBrickOAuthReturnPath,
} from "../_shared/brick/brickFinancialAuth.ts";

type OAuthStateRow = {
  id: string;
  organization_id: string;
  user_id: string;
  target_type: "bank_account" | "debt";
  target_id: string;
  expires_at: string;
  return_path?: string | null;
};

function extractUserAccessToken(url: URL): string {
  const candidates = [
    url.searchParams.get("userAccessToken"),
    url.searchParams.get("user_access_token"),
    url.searchParams.get("accessToken"),
    url.searchParams.get("access_token"),
    url.searchParams.get("token"),
  ];
  for (const c of candidates) {
    const v = c?.trim();
    if (v) return v;
  }
  return "";
}

function extractRefreshToken(url: URL): string | null {
  const candidates = [
    url.searchParams.get("refreshToken"),
    url.searchParams.get("refresh_token"),
  ];
  for (const c of candidates) {
    const v = c?.trim();
    if (v) return v;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error")?.trim() ?? "";
  const userAccessToken = extractUserAccessToken(url);
  const refreshToken = extractRefreshToken(url);
  const brickUserId = url.searchParams.get("userId")?.trim() ??
    url.searchParams.get("user_id")?.trim() ?? null;

  const redirectDefault = (query: string, returnPath?: string | null) =>
    redirectToAppPath(resolveBrickOAuthReturnPath(returnPath), query);

  if (oauthError) {
    return redirectDefault(`?brick_oauth=error&oauth_error=${encodeURIComponent(oauthError)}`);
  }
  if (!state || !userAccessToken) {
    return redirectDefault("?brick_oauth=error&oauth_error=missing_token_or_state");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectDefault("?brick_oauth=error&oauth_error=server_misconfigured");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: stateRow, error: stateErr } = await admin
    .from("brick_oauth_states")
    .select("id, organization_id, user_id, target_type, target_id, expires_at, return_path")
    .eq("state_token", state)
    .maybeSingle();

  const oauthReturnPath = resolveBrickOAuthReturnPath(
    stateRow?.return_path != null ? String(stateRow.return_path) : null,
  );

  if (stateErr || !stateRow?.id) {
    return redirectDefault("?brick_oauth=error&oauth_error=invalid_state", oauthReturnPath);
  }

  const row = stateRow as OAuthStateRow;
  const expiresAt = new Date(String(row.expires_at)).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    await admin.from("brick_oauth_states").delete().eq("id", row.id);
    return redirectDefault("?brick_oauth=error&oauth_error=state_expired", oauthReturnPath);
  }

  await admin.from("brick_oauth_states").delete().eq("id", row.id);

  const linkResult = await completeBrickOAuthLink(admin, {
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    targetType: row.target_type,
    targetId: String(row.target_id),
    userAccessToken,
    refreshToken,
    brickUserId,
    rawPayload: Object.fromEntries(url.searchParams.entries()),
  });

  if (!linkResult.ok) {
    return redirectDefault(
      `?brick_oauth=error&oauth_error=${encodeURIComponent(linkResult.error)}`,
      oauthReturnPath,
    );
  }

  return redirectDefault(
    `?brick_oauth=success&oauth_nonce=${encodeURIComponent(state)}`,
    oauthReturnPath,
  );
});
