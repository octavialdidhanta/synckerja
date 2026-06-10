/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { saveYouTubeChannelConnection } from "../_shared/youtubeContentConnectionSave.ts";
import { decryptYouTubeContentToken } from "../_shared/youtubeContentConfigCrypto.ts";
import type { YouTubeChannelRow } from "../_shared/youtubeContentApi.ts";
import {
  getUserFromBearer,
  isYouTubeContentPlatformConfigured,
  requireActiveOrg,
  requireOrgAdmin,
  requireYouTubeContentPlatformConfigured,
  youtubeContentCorsHeaders,
  youtubeContentJson,
} from "../_shared/youtubeContentAuth.ts";

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

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return youtubeContentJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return youtubeContentJson({ error: "Missing organization_id" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
  if (orgForbidden) return orgForbidden;

  if (action === "getSettings") {
    const { data: connection } = await admin
      .from("organization_youtube_content_connections")
      .select("organization_id, is_active, oauth_connected_at, updated_at")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const { data: accounts } = await admin
      .from("organization_youtube_content_accounts")
      .select("id, channel_id, label, display_name, thumbnail_url, is_default, sort_order, is_active, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true });

    const { data: tokenRows } = await admin
      .from("organization_youtube_content_connection_tokens")
      .select("channel_id")
      .eq("organization_id", organizationId);

    return youtubeContentJson({
      connection: connection ?? null,
      oauthConnected: (tokenRows ?? []).length > 0,
      accounts: accounts ?? [],
      serverConfigured: isYouTubeContentPlatformConfigured(),
    }, 200);
  }

  if (action === "getPendingChannels") {
    const adminForbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
    if (adminForbidden) return adminForbidden;

    const now = new Date().toISOString();
    const { data: pending } = await admin
      .from("youtube_content_pending_connections")
      .select("id, channels_json, expires_at")
      .eq("organization_id", organizationId)
      .eq("user_id", userRes.userId)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pending?.id) {
      return youtubeContentJson({ pending: false, channels: [] }, 200);
    }

    const channels = (pending.channels_json ?? []) as YouTubeChannelRow[];
    return youtubeContentJson({ pending: true, channels }, 200);
  }

  const adminForbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (adminForbidden) return adminForbidden;

  const platformForbidden = requireYouTubeContentPlatformConfigured();
  if (platformForbidden && action !== "disconnect") return platformForbidden;

  if (action === "completeChannelConnect") {
    const channelId = String(body.channel_id ?? "").trim();
    if (!channelId) return youtubeContentJson({ error: "Missing channel_id" }, 400);

    const now = new Date().toISOString();
    const { data: pending } = await admin
      .from("youtube_content_pending_connections")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userRes.userId)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pending?.id) {
      return youtubeContentJson({ error: "No pending YouTube connection" }, 400);
    }

    const channels = (pending.channels_json ?? []) as YouTubeChannelRow[];
    const channel = channels.find((c) => c.channel_id === channelId);
    if (!channel) {
      return youtubeContentJson({ error: "Channel not found in pending connection" }, 400);
    }

    let accessToken: string;
    let refreshToken: string;
    try {
      accessToken = await decryptYouTubeContentToken(String(pending.access_token_enc));
      refreshToken = await decryptYouTubeContentToken(String(pending.refresh_token_enc));
    } catch (e) {
      console.error("completeChannelConnect decrypt:", e);
      return youtubeContentJson({ error: "Failed to decrypt pending tokens" }, 500);
    }

    try {
      const { isExistingAccount } = await saveYouTubeChannelConnection(admin, {
        organizationId,
        userId: userRes.userId,
        channel,
        accessToken,
        refreshToken,
        expiresIn: pending.access_token_expires_at
          ? Math.max(
            0,
            Math.floor(
              (new Date(String(pending.access_token_expires_at)).getTime() - Date.now()) / 1000,
            ),
          )
          : undefined,
      });

      await admin.from("youtube_content_pending_connections").delete().eq("id", pending.id);

      return youtubeContentJson({ ok: true, isExistingAccount }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "save_failed";
      console.error("completeChannelConnect save:", msg);
      return youtubeContentJson({ error: msg }, 500);
    }
  }

  if (action === "disconnect") {
    const channelId = body.channel_id != null ? String(body.channel_id).trim() : "";
    if (channelId) {
      await admin.from("organization_youtube_content_connection_tokens")
        .delete()
        .eq("organization_id", organizationId)
        .eq("channel_id", channelId);
      await admin.from("organization_youtube_content_accounts")
        .delete()
        .eq("organization_id", organizationId)
        .eq("channel_id", channelId);
    } else {
      await admin.from("organization_youtube_content_connection_tokens")
        .delete()
        .eq("organization_id", organizationId);
      await admin.from("organization_youtube_content_accounts")
        .delete()
        .eq("organization_id", organizationId);
    }

    await admin.from("youtube_content_pending_connections")
      .delete()
      .eq("organization_id", organizationId);

    const { data: remaining } = await admin
      .from("organization_youtube_content_connection_tokens")
      .select("channel_id")
      .eq("organization_id", organizationId);

    if ((remaining ?? []).length === 0) {
      await admin.from("organization_youtube_content_connections").upsert({
        organization_id: organizationId,
        oauth_connected_at: null,
        is_active: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id" });
    }

    return youtubeContentJson({ ok: true }, 200);
  }

  if (action === "setDefaultAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return youtubeContentJson({ error: "Missing account_id" }, 400);
    await admin.from("organization_youtube_content_accounts")
      .update({ is_default: false })
      .eq("organization_id", organizationId);
    const { error } = await admin
      .from("organization_youtube_content_accounts")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return youtubeContentJson({ error: error.message }, 500);
    return youtubeContentJson({ ok: true }, 200);
  }

  if (action === "deleteAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return youtubeContentJson({ error: "Missing account_id" }, 400);
    const { data: acc } = await admin
      .from("organization_youtube_content_accounts")
      .select("channel_id")
      .eq("id", accountId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (acc?.channel_id) {
      await admin.from("organization_youtube_content_connection_tokens")
        .delete()
        .eq("organization_id", organizationId)
        .eq("channel_id", String(acc.channel_id));
    }
    const { error } = await admin
      .from("organization_youtube_content_accounts")
      .delete()
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return youtubeContentJson({ error: error.message }, 500);
    return youtubeContentJson({ ok: true }, 200);
  }

  return youtubeContentJson({ error: "Unknown action" }, 400);
});
