import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { YouTubeChannelRow } from "./youtubeContentApi.ts";
import {
  encryptYouTubeContentToken,
} from "./youtubeContentConfigCrypto.ts";

export async function saveYouTubeChannelConnection(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    userId: string;
    channel: YouTubeChannelRow;
    accessToken: string;
    refreshToken: string;
    expiresIn?: number;
    oauthScopes?: string | null;
  },
): Promise<{ isExistingAccount: boolean }> {
  const { organizationId, userId, channel, accessToken, refreshToken, expiresIn, oauthScopes } = args;
  const channelId = channel.channel_id;
  const now = new Date().toISOString();
  const accessExpires = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  const accessEnc = await encryptYouTubeContentToken(accessToken);
  const refreshEnc = await encryptYouTubeContentToken(refreshToken);

  await admin.from("organization_youtube_content_connections").upsert(
    {
      organization_id: organizationId,
      oauth_connected_at: now,
      is_active: true,
      updated_at: now,
      created_by: userId,
    },
    { onConflict: "organization_id" },
  );

  await admin.from("organization_youtube_content_connection_tokens").upsert(
    {
      organization_id: organizationId,
      channel_id: channelId,
      access_token_enc: accessEnc,
      refresh_token_enc: refreshEnc,
      access_token_expires_at: accessExpires,
      oauth_scopes: oauthScopes?.trim() || null,
      updated_at: now,
    },
    { onConflict: "organization_id,channel_id" },
  );

  const { data: existingAccounts } = await admin
    .from("organization_youtube_content_accounts")
    .select("id, is_default, channel_id, sort_order")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  const hasDefault = (existingAccounts ?? []).some(
    (a) => Boolean((a as { is_default?: boolean }).is_default),
  );
  const existingChannel = (existingAccounts ?? []).find(
    (a) => String((a as { channel_id?: string }).channel_id) === channelId,
  );
  const isExistingAccount = Boolean(existingChannel);
  const maxSort = (existingAccounts ?? []).reduce(
    (m, a) => Math.max(m, Number((a as { sort_order?: number }).sort_order) || 0),
    0,
  );

  const displayName = channel.title || `YouTube ${channelId.slice(0, 8)}`;

  await admin.from("organization_youtube_content_accounts").upsert(
    {
      organization_id: organizationId,
      channel_id: channelId,
      label: displayName,
      display_name: displayName,
      thumbnail_url: channel.thumbnail_url,
      is_default: existingChannel
        ? Boolean((existingChannel as { is_default?: boolean }).is_default)
        : !hasDefault,
      sort_order: existingChannel
        ? Number((existingChannel as { sort_order?: number }).sort_order) || 0
        : maxSort + 1,
      is_active: true,
      updated_at: now,
    },
    { onConflict: "organization_id,channel_id" },
  );

  return { isExistingAccount };
}
