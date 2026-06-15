import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  LINKEDIN_CONTENT_OAUTH_RETURN_PATHS,
  linkedinContentOAuthScopes,
  readPlatformLinkedInContentOAuth,
  requireOrgAdmin,
  requireLinkedInContentPlatformConfigured,
  linkedinContentJson,
  linkedinContentOAuthRedirectUri,
} from "../../_shared/linkedinContentAuth.ts";

function randomUrlSafe(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function handleLinkedInOAuthStart(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const platformForbidden = requireLinkedInContentPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const oauth = readPlatformLinkedInContentOAuth()!;
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return linkedinContentJson({ error: "Missing organization_id" }, 400);

  const forbidden = await requireOrgAdmin(admin, userId, organizationId);
  if (forbidden) return forbidden;

  const returnPathRaw = body.return_path != null ? String(body.return_path).trim() : "";
  const returnPath = LINKEDIN_CONTENT_OAUTH_RETURN_PATHS.has(returnPathRaw) ? returnPathRaw : null;

  const stateToken = randomUrlSafe(32);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: stateErr } = await admin.from("linkedin_content_oauth_states").insert({
    organization_id: organizationId,
    user_id: userId,
    state_token: stateToken,
    expires_at: expiresAt,
    ...(returnPath ? { return_path: returnPath } : {}),
  });
  if (stateErr) {
    console.error("linkedin-content-api oauthStart:", stateErr.message);
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
}
