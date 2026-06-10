/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  YOUTUBE_CONTENT_OAUTH_RETURN_PATHS,
  YOUTUBE_CONTENT_OAUTH_SCOPES,
  readPlatformYouTubeContentOAuth,
  requireOrgAdmin,
  requireYouTubeContentPlatformConfigured,
  getUserFromBearer,
  youtubeContentJson,
  youtubeContentOAuthRedirectUri,
  youtubeContentCorsHeaders,
} from "../_shared/youtubeContentAuth.ts";

function randomUrlSafe(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: youtubeContentCorsHeaders });
  }
  if (req.method !== "POST") {
    return youtubeContentJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return youtubeContentJson({ error: "Server misconfigured" }, 500);
  }

  const platformForbidden = requireYouTubeContentPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const oauth = readPlatformYouTubeContentOAuth()!;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return youtubeContentJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return youtubeContentJson({ error: "Missing organization_id" }, 400);

  const forbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (forbidden) return forbidden;

  const returnPathRaw = body.return_path != null ? String(body.return_path).trim() : "";
  const returnPath = YOUTUBE_CONTENT_OAUTH_RETURN_PATHS.has(returnPathRaw) ? returnPathRaw : null;

  const stateToken = randomUrlSafe(32);
  const codeVerifier = randomUrlSafe(48);
  const codeChallenge = await pkceChallenge(codeVerifier);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: stateErr } = await admin.from("youtube_content_oauth_states").insert({
    organization_id: organizationId,
    user_id: userRes.userId,
    state_token: stateToken,
    code_verifier: codeVerifier,
    expires_at: expiresAt,
    ...(returnPath ? { return_path: returnPath } : {}),
  });
  if (stateErr) {
    console.error("youtube-content-oauth-start state insert:", stateErr.message);
    return youtubeContentJson({ error: "Failed to start OAuth" }, 500);
  }

  const redirectUri = youtubeContentOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: oauth.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_CONTENT_OAUTH_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: stateToken,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return youtubeContentJson({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  }, 200);
});
