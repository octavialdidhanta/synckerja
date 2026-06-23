/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  TIKTOK_CONTENT_OAUTH_RETURN_PATHS,
  TIKTOK_CONTENT_OAUTH_SCOPES,
  readPlatformTikTokContentOAuth,
  requireOrgAdmin,
  requireTikTokContentPlatformConfigured,
  getUserFromBearer,
  tiktokContentJson,
  tiktokContentOAuthRedirectUri,
  tiktokContentCorsHeaders,
} from "../_shared/tiktokContentAuth.ts";

function randomUrlSafe(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: tiktokContentCorsHeaders });
  }
  if (req.method !== "POST") {
    return tiktokContentJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return tiktokContentJson({ error: "Server misconfigured" }, 500);
  }

  const platformForbidden = requireTikTokContentPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const oauth = readPlatformTikTokContentOAuth()!;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return tiktokContentJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return tiktokContentJson({ error: "Missing organization_id" }, 400);

  const forbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (forbidden) return forbidden;

  const returnPathRaw = body.return_path != null ? String(body.return_path).trim() : "";
  const returnPath = TIKTOK_CONTENT_OAUTH_RETURN_PATHS.has(returnPathRaw) ? returnPathRaw : null;
  const oauthPurposeRaw = String(body.oauth_purpose ?? "full").trim().toLowerCase();
  const oauthPurpose = oauthPurposeRaw === "publish" ? "publish" : "full";
  const targetOpenId = body.open_id != null ? String(body.open_id).trim() : "";

  if (oauthPurpose === "publish") {
    if (!targetOpenId) {
      return tiktokContentJson({ error: "Missing open_id for publish authorization" }, 400);
    }
    const { data: tokenRow } = await admin
      .from("organization_tiktok_content_connection_tokens")
      .select("open_id")
      .eq("organization_id", organizationId)
      .eq("open_id", targetOpenId)
      .maybeSingle();
    if (!tokenRow?.open_id) {
      return tiktokContentJson({ error: "TikTok account not connected" }, 400);
    }
  }

  const stateToken = randomUrlSafe(32);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: stateErr } = await admin.from("tiktok_content_oauth_states").insert({
    organization_id: organizationId,
    user_id: userRes.userId,
    state_token: stateToken,
    expires_at: expiresAt,
    oauth_purpose: oauthPurpose,
    ...(oauthPurpose === "publish" ? { target_open_id: targetOpenId } : {}),
    ...(returnPath ? { return_path: returnPath } : {}),
  });
  if (stateErr) {
    console.error("tiktok-content-oauth-start state insert:", stateErr.message);
    return tiktokContentJson({ error: "Failed to start OAuth" }, 500);
  }

  const redirectUri = tiktokContentOAuthRedirectUri();
  const params = new URLSearchParams({
    client_key: oauth.clientKey,
    scope: TIKTOK_CONTENT_OAUTH_SCOPES,
    response_type: "code",
    redirect_uri: redirectUri,
    state: stateToken,
    disable_auto_auth: "1",
  });

  // Account Comment API: account-holder OAuth (v2 authorize + tt_user token exchange).
  const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  return tiktokContentJson({ url }, 200);
});
