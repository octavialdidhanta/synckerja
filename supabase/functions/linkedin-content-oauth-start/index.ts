/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  LINKEDIN_CONTENT_OAUTH_RETURN_PATHS,
  linkedinContentOAuthScopes,
  readPlatformLinkedInContentOAuth,
  requireOrgAdmin,
  requireLinkedInContentPlatformConfigured,
  getUserFromBearer,
  linkedinContentJson,
  linkedinContentOAuthRedirectUri,
  linkedinContentCorsHeaders,
} from "../_shared/linkedinContentAuth.ts";

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
    return new Response("ok", { status: 200, headers: linkedinContentCorsHeaders });
  }
  if (req.method !== "POST") {
    return linkedinContentJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return linkedinContentJson({ error: "Server misconfigured" }, 500);
  }

  const platformForbidden = requireLinkedInContentPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const oauth = readPlatformLinkedInContentOAuth()!;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return linkedinContentJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return linkedinContentJson({ error: "Missing organization_id" }, 400);

  const forbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (forbidden) return forbidden;

  const returnPathRaw = body.return_path != null ? String(body.return_path).trim() : "";
  const returnPath = LINKEDIN_CONTENT_OAUTH_RETURN_PATHS.has(returnPathRaw) ? returnPathRaw : null;

  const stateToken = randomUrlSafe(32);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: stateErr } = await admin.from("linkedin_content_oauth_states").insert({
    organization_id: organizationId,
    user_id: userRes.userId,
    state_token: stateToken,
    expires_at: expiresAt,
    ...(returnPath ? { return_path: returnPath } : {}),
  });
  if (stateErr) {
    console.error("linkedin-content-oauth-start state insert:", stateErr.message);
    return linkedinContentJson({ error: "Failed to start OAuth" }, 500);
  }

  const redirectUri = linkedinContentOAuthRedirectUri();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: oauth.clientId,
    redirect_uri: redirectUri,
    state: stateToken,
    scope: linkedinContentOAuthScopes(),
  });

  return linkedinContentJson({
    url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
  }, 200);
});
