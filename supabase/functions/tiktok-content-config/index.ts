/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  isTikTokContentPlatformConfigured,
  requireActiveOrg,
  requireOrgAdmin,
  requireTikTokContentPlatformConfigured,
  tiktokContentCorsHeaders,
  tiktokContentJson,
  mergeTikTokContentOAuthScopes,
  resolveTikTokContentOAuthScopes,
  TIKTOK_CONTENT_OAUTH_SCOPES,
  TIKTOK_CONTENT_OAUTH_TOKEN_KINDS,
  tiktokContentScopesIncludeComments,
} from "../_shared/tiktokContentAuth.ts";
import {
  pickTikTokAccountLabel,
  syncTikTokContentAccountProfiles,
} from "../_shared/tiktokContentAccountProfile.ts";

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

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return tiktokContentJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return tiktokContentJson({ error: "Missing organization_id" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
  if (orgForbidden) return orgForbidden;

  if (action === "getSettings") {
    const { data: connection } = await admin
      .from("organization_tiktok_content_connections")
      .select("organization_id, is_active, oauth_connected_at, updated_at")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const { data: accounts } = await admin
      .from("organization_tiktok_content_accounts")
      .select("id, open_id, label, display_name, avatar_url, is_default, sort_order, is_active, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true });

    const { data: tokenRows } = await admin
      .from("organization_tiktok_content_connection_tokens")
      .select("open_id, oauth_scopes, oauth_token_kind")
      .eq("organization_id", organizationId);

    const scopesByOpenId = new Map<string, string | null>();
    const tokenKindByOpenId = new Map<string, string | null>();
    for (const row of tokenRows ?? []) {
      const r = row as { open_id?: string; oauth_scopes?: string | null; oauth_token_kind?: string | null };
      if (r.open_id) {
        scopesByOpenId.set(String(r.open_id), r.oauth_scopes ?? null);
        tokenKindByOpenId.set(String(r.open_id), r.oauth_token_kind ?? null);
      }
    }

    const now = new Date().toISOString();
    const backfillUpdates: Promise<unknown>[] = [];
    for (const [openId, storedScope] of scopesByOpenId) {
      const resolvedScope = resolveTikTokContentOAuthScopes(storedScope);
      scopesByOpenId.set(openId, resolvedScope);
      const storedTrimmed = storedScope != null ? storedScope.trim() : "";
      if (resolvedScope !== storedTrimmed) {
        backfillUpdates.push(
          admin
            .from("organization_tiktok_content_connection_tokens")
            .update({ oauth_scopes: resolvedScope, updated_at: now })
            .eq("organization_id", organizationId)
            .eq("open_id", openId),
        );
      }
    }
    if (backfillUpdates.length > 0) {
      await Promise.all(backfillUpdates);
    }

    let accountRows = (accounts ?? []) as Array<{
      id: string;
      open_id: string;
      label: string;
      display_name: string | null;
      avatar_url?: string | null;
      is_active: boolean;
      [key: string]: unknown;
    }>;

    const profileSyncCount = await syncTikTokContentAccountProfiles(
      admin,
      organizationId,
      accountRows,
    );
    if (profileSyncCount > 0) {
      const { data: refreshedAccounts } = await admin
        .from("organization_tiktok_content_accounts")
        .select("id, open_id, label, display_name, avatar_url, is_default, sort_order, is_active, created_at, updated_at")
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true });
      accountRows = (refreshedAccounts ?? accountRows) as typeof accountRows;
    }

    const accountsWithScopes = accountRows.map((acc) => {
      const scope = scopesByOpenId.get(acc.open_id) ?? null;
      const tokenKind = tokenKindByOpenId.get(acc.open_id) ?? TIKTOK_CONTENT_OAUTH_TOKEN_KINDS.loginKit;
      const resolvedLabel = pickTikTokAccountLabel(acc);
      return {
        ...acc,
        label: resolvedLabel,
        display_name: resolvedLabel,
        oauth_scopes: scope,
        oauth_token_kind: tokenKind,
        comments_scopes_granted: tokenKind === TIKTOK_CONTENT_OAUTH_TOKEN_KINDS.ttUser,
      };
    });

    return tiktokContentJson({
      connection: connection ?? null,
      oauthConnected: (tokenRows ?? []).length > 0,
      accounts: accountsWithScopes,
      serverConfigured: isTikTokContentPlatformConfigured(),
    }, 200);
  }

  const adminForbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (adminForbidden) return adminForbidden;

  const platformForbidden = requireTikTokContentPlatformConfigured();
  if (platformForbidden && action !== "disconnect") return platformForbidden;

  if (action === "disconnect") {
    const openId = body.open_id != null ? String(body.open_id).trim() : "";
    if (openId) {
      await admin.from("organization_tiktok_content_connection_tokens")
        .delete()
        .eq("organization_id", organizationId)
        .eq("open_id", openId);
      await admin.from("organization_tiktok_content_accounts")
        .delete()
        .eq("organization_id", organizationId)
        .eq("open_id", openId);
    } else {
      await admin.from("organization_tiktok_content_connection_tokens")
        .delete()
        .eq("organization_id", organizationId);
      await admin.from("organization_tiktok_content_accounts")
        .delete()
        .eq("organization_id", organizationId);
    }

    const { data: remaining } = await admin
      .from("organization_tiktok_content_connection_tokens")
      .select("open_id")
      .eq("organization_id", organizationId);

    if ((remaining ?? []).length === 0) {
      await admin.from("organization_tiktok_content_connections").upsert({
        organization_id: organizationId,
        oauth_connected_at: null,
        is_active: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id" });
    }

    return tiktokContentJson({ ok: true }, 200);
  }

  if (action === "setDefaultAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return tiktokContentJson({ error: "Missing account_id" }, 400);
    await admin.from("organization_tiktok_content_accounts")
      .update({ is_default: false })
      .eq("organization_id", organizationId);
    const { error } = await admin
      .from("organization_tiktok_content_accounts")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return tiktokContentJson({ error: error.message }, 500);
    return tiktokContentJson({ ok: true }, 200);
  }

  if (action === "deleteAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return tiktokContentJson({ error: "Missing account_id" }, 400);
    const { data: acc } = await admin
      .from("organization_tiktok_content_accounts")
      .select("open_id")
      .eq("id", accountId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (acc?.open_id) {
      await admin.from("organization_tiktok_content_connection_tokens")
        .delete()
        .eq("organization_id", organizationId)
        .eq("open_id", String(acc.open_id));
    }
    const { error } = await admin
      .from("organization_tiktok_content_accounts")
      .delete()
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return tiktokContentJson({ error: error.message }, 500);
    return tiktokContentJson({ ok: true }, 200);
  }

  return tiktokContentJson({ error: "Unknown action" }, 400);
});
