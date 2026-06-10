/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  TIKTOK_ADS_OAUTH_RETURN_PATHS,
  readPlatformTikTokAdsOAuth,
  requireOrgAdmin,
  requireTikTokAdsPlatformConfigured,
  getUserFromBearer,
  tiktokAdsJson,
  tiktokAdsOAuthRedirectUri,
  tiktokAdsCorsHeaders,
} from "../_shared/tiktokAdsAuth.ts";

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
    return new Response("ok", { status: 200, headers: tiktokAdsCorsHeaders });
  }
  if (req.method !== "POST") {
    return tiktokAdsJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return tiktokAdsJson({ error: "Server misconfigured" }, 500);
  }

  const platformForbidden = requireTikTokAdsPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const oauth = readPlatformTikTokAdsOAuth()!;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return tiktokAdsJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return tiktokAdsJson({ error: "Missing organization_id" }, 400);

  const forbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (forbidden) return forbidden;

  const returnPathRaw = body.return_path != null ? String(body.return_path).trim() : "";
  const returnPath = TIKTOK_ADS_OAUTH_RETURN_PATHS.has(returnPathRaw) ? returnPathRaw : null;

  const stateToken = randomUrlSafe(32);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: stateErr } = await admin.from("tiktok_ads_oauth_states").insert({
    organization_id: organizationId,
    user_id: userRes.userId,
    state_token: stateToken,
    expires_at: expiresAt,
    ...(returnPath ? { return_path: returnPath } : {}),
  });
  if (stateErr) {
    console.error("tiktok-ads-oauth-start state insert:", stateErr.message);
    return tiktokAdsJson({ error: "Failed to start OAuth" }, 500);
  }

  const redirectUri = tiktokAdsOAuthRedirectUri();
  const rid = randomUrlSafe(16);
  const params = new URLSearchParams({
    app_id: oauth.appId,
    state: stateToken,
    redirect_uri: redirectUri,
    rid,
  });

  const url = `https://business-api.tiktok.com/portal/auth?${params.toString()}`;
  return tiktokAdsJson({ url }, 200);
});
