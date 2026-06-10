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
} from "../_shared/tiktokContentAuth.ts";

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
      .select("open_id")
      .eq("organization_id", organizationId);

    return tiktokContentJson({
      connection: connection ?? null,
      oauthConnected: (tokenRows ?? []).length > 0,
      accounts: accounts ?? [],
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
