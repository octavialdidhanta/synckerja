/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserIdFromBearer,
  isOrgOwnerOrAdmin,
  ORG_DRIVE_OAUTH_SCOPES,
  orgDriveCorsHeaders,
  orgDriveJson,
  orgDriveOAuthRedirectUri,
  readGoogleOAuthClient,
} from "../_shared/orgDrive/access.ts";
import { isOrgDriveEncryptionReady } from "../_shared/orgDrive/crypto.ts";

/** Owner/admin starts connecting ONE Google account as the organization's Drive ("gudang org"). */

function randomUrlSafe(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: orgDriveCorsHeaders });
  if (req.method !== "POST") return orgDriveJson({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return orgDriveJson({ error: "Server misconfigured" }, 500);

  const client = readGoogleOAuthClient();
  if (!client) return orgDriveJson({ error: "Google OAuth belum dikonfigurasi di server" }, 503);
  if (!isOrgDriveEncryptionReady()) return orgDriveJson({ error: "Kunci enkripsi token belum diatur di server" }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userId = await getUserIdFromBearer(admin, req.headers.get("Authorization"));
  if (!userId) return orgDriveJson({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return orgDriveJson({ error: "Invalid JSON body" }, 400);
  }
  const organizationId = String(body.organization_id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return orgDriveJson({ error: "Missing organization_id" }, 400);

  if (!(await isOrgOwnerOrAdmin(admin, userId, organizationId))) {
    return orgDriveJson({ error: "Hanya owner atau admin yang bisa menyambungkan Google Drive org" }, 403);
  }

  const stateToken = randomUrlSafe(32);
  const codeVerifier = randomUrlSafe(48);
  const { error } = await admin.from("google_drive_org_oauth_states").insert({
    organization_id: organizationId,
    user_id: userId,
    state_token: stateToken,
    code_verifier: codeVerifier,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (error) {
    console.error("google-drive-org-oauth-start: state insert", error.message);
    return orgDriveJson({ error: "Gagal memulai sambungan Google" }, 500);
  }
  await admin.from("google_drive_org_oauth_states").delete().lt("expires_at", new Date().toISOString());

  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: orgDriveOAuthRedirectUri(),
    response_type: "code",
    scope: ORG_DRIVE_OAUTH_SCOPES,
    access_type: "offline",
    // Always show the account chooser: the org Drive is usually NOT the account the owner is signed in with.
    prompt: "consent select_account",
    include_granted_scopes: "false",
    state: stateToken,
    code_challenge: await pkceChallenge(codeVerifier),
    code_challenge_method: "S256",
  });
  return orgDriveJson({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});
