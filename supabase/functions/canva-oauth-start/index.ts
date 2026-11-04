/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canvaEncryptionReady } from "../_shared/canvaConfigCrypto.ts";
import {
  CANVA_AUTHORIZE_URL,
  CANVA_OAUTH_SCOPES,
  canvaCorsHeaders,
  canvaJson,
  canvaOAuthRedirectUri,
  getUserFromBearer,
  readPlatformCanvaOAuth,
  requireActiveOrgMember,
  requireOrgOwnerOrAdmin,
} from "../_shared/canvaAuth.ts";

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
    return new Response("ok", { status: 200, headers: canvaCorsHeaders });
  }
  if (req.method !== "POST") return canvaJson({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return canvaJson({ error: "Server misconfigured" }, 500);

  const oauth = readPlatformCanvaOAuth();
  if (!oauth) return canvaJson({ error: "Canva OAuth is not configured on the server" }, 503);
  if (!canvaEncryptionReady()) {
    return canvaJson({ error: "CANVA_CONFIG_ENCRYPTION_KEY is not set" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return canvaJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return canvaJson({ error: "Missing organization_id" }, 400);

  const memberError = await requireActiveOrgMember(admin, userRes.userId, organizationId);
  if (memberError) return memberError;
  const roleError = await requireOrgOwnerOrAdmin(admin, userRes.userId, organizationId);
  if (roleError) return roleError;

  const stateToken = randomUrlSafe(32);
  const codeVerifier = randomUrlSafe(48);
  const codeChallenge = await pkceChallenge(codeVerifier);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: stateErr } = await admin.from("canva_oauth_states").insert({
    organization_id: organizationId,
    user_id: userRes.userId,
    state_token: stateToken,
    code_verifier: codeVerifier,
    expires_at: expiresAt,
  });
  if (stateErr) {
    console.error("canva-oauth-start state insert:", stateErr.message);
    return canvaJson({ error: "Failed to start OAuth" }, 500);
  }

  const params = new URLSearchParams({
    client_id: oauth.clientId,
    redirect_uri: canvaOAuthRedirectUri(),
    response_type: "code",
    scope: CANVA_OAUTH_SCOPES,
    state: stateToken,
    code_challenge: codeChallenge,
    code_challenge_method: "s256",
  });

  return canvaJson({ url: `${CANVA_AUTHORIZE_URL}?${params.toString()}` }, 200);
});
