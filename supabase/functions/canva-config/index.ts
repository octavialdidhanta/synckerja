/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CANVA_OAUTH_SCOPES,
  canvaCorsHeaders,
  canvaJson,
  canvaOAuthRedirectUri,
  getUserFromBearer,
  readPlatformCanvaOAuth,
  requireActiveOrgMember,
  requireOrgOwnerOrAdmin,
} from "../_shared/canvaAuth.ts";
import { canvaEncryptionReady, decryptCanvaToken } from "../_shared/canvaConfigCrypto.ts";
import { listCanvaMcpTools } from "../_shared/canvaMcp.ts";
import { getCanvaAccessToken, revokeCanvaToken } from "../_shared/canvaToken.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: canvaCorsHeaders });
  }
  if (req.method !== "POST") return canvaJson({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return canvaJson({ error: "Server misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return canvaJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return canvaJson({ error: "Missing organization_id" }, 400);

  const memberError = await requireActiveOrgMember(admin, userRes.userId, organizationId);
  if (memberError) return memberError;

  if (action === "getSettings") {
    const { data: connection } = await admin
      .from("organization_canva_connections")
      .select(
        "organization_id, canva_user_id, canva_team_id, display_name, is_active, oauth_connected_at, last_error, updated_at",
      )
      .eq("organization_id", organizationId)
      .maybeSingle();
    const { data: tokenRow } = await admin
      .from("organization_canva_connection_tokens")
      .select("organization_id, oauth_scopes")
      .eq("organization_id", organizationId)
      .maybeSingle();

    return canvaJson({
      oauthConfigured: Boolean(readPlatformCanvaOAuth()),
      encryptionReady: canvaEncryptionReady(),
      redirectUri: canvaOAuthRedirectUri(),
      requiredScopes: CANVA_OAUTH_SCOPES,
      oauthConnected: Boolean(tokenRow?.organization_id) && connection?.is_active === true,
      oauthScopes: tokenRow?.oauth_scopes ?? null,
      connection: connection ?? null,
    }, 200);
  }

  const roleError = await requireOrgOwnerOrAdmin(admin, userRes.userId, organizationId);
  if (roleError) return roleError;

  if (action === "disconnect") {
    const { data: tokenRow } = await admin
      .from("organization_canva_connection_tokens")
      .select("refresh_token_enc")
      .eq("organization_id", organizationId)
      .maybeSingle();
    let revokeFailed = false;
    if (tokenRow?.refresh_token_enc) {
      try {
        const refreshToken = await decryptCanvaToken(String(tokenRow.refresh_token_enc));
        revokeFailed = !(await revokeCanvaToken(refreshToken));
      } catch {
        revokeFailed = true;
      }
    }
    await admin.from("organization_canva_connection_tokens").delete().eq("organization_id", organizationId);
    const now = new Date().toISOString();
    await admin.from("organization_canva_connections").upsert(
      {
        organization_id: organizationId,
        canva_user_id: null,
        canva_team_id: null,
        display_name: null,
        is_active: false,
        oauth_connected_at: null,
        last_error: revokeFailed ? "revoke_failed" : null,
        updated_at: now,
      },
      { onConflict: "organization_id" },
    );
    return canvaJson({ ok: true, revokeFailed }, 200);
  }

  if (action === "probe") {
    if (!readPlatformCanvaOAuth() || !canvaEncryptionReady()) {
      return canvaJson({ error: "Canva is not configured on the server" }, 503);
    }
    try {
      let accessToken = await getCanvaAccessToken(admin, organizationId);
      let toolNames: string[];
      try {
        toolNames = await listCanvaMcpTools(accessToken);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "canva_unauthorized") throw error;
        accessToken = await getCanvaAccessToken(admin, organizationId, { forceRefresh: true });
        toolNames = await listCanvaMcpTools(accessToken);
      }
      await admin
        .from("organization_canva_connections")
        .update({ last_error: null, updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId);
      return canvaJson({
        ok: true,
        toolCount: toolNames.length,
        toolNames: toolNames.slice(0, 80),
      }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "probe_failed";
      await admin
        .from("organization_canva_connections")
        .update({ last_error: message.slice(0, 180), updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId);
      return canvaJson({ ok: false, error: message }, 200);
    }
  }

  return canvaJson({ error: "Unknown action" }, 400);
});
