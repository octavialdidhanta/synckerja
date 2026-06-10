import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decryptYouTubeContentToken,
  encryptYouTubeContentToken,
} from "./youtubeContentConfigCrypto.ts";
import { readPlatformYouTubeContentOAuth } from "./youtubeContentAuth.ts";
import { refreshYouTubeContentAccessToken } from "./youtubeContentApi.ts";

export type YouTubeContentAccountRow = {
  id: string;
  organization_id: string;
  channel_id: string;
  label: string;
  display_name: string | null;
  thumbnail_url: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

type TokenRow = {
  access_token_enc: string;
  refresh_token_enc: string;
  access_token_expires_at: string | null;
};

export async function getYouTubeContentAccessToken(
  admin: SupabaseClient,
  organizationId: string,
  channelId: string,
): Promise<string | null> {
  const { data: row } = await admin
    .from("organization_youtube_content_connection_tokens")
    .select("access_token_enc, refresh_token_enc, access_token_expires_at")
    .eq("organization_id", organizationId)
    .eq("channel_id", channelId)
    .maybeSingle();
  if (!row?.access_token_enc || !row?.refresh_token_enc) return null;

  const tokenRow = row as TokenRow;
  const expiresAtMs = tokenRow.access_token_expires_at
    ? new Date(String(tokenRow.access_token_expires_at)).getTime()
    : null;
  const needsRefresh = expiresAtMs != null &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs < Date.now() + 60_000;

  if (!needsRefresh) {
    try {
      return await decryptYouTubeContentToken(String(tokenRow.access_token_enc));
    } catch (e) {
      console.error("getYouTubeContentAccessToken decrypt:", e);
    }
  }

  let refreshToken: string;
  try {
    refreshToken = await decryptYouTubeContentToken(String(tokenRow.refresh_token_enc));
  } catch (e) {
    console.error("getYouTubeContentAccessToken refresh decrypt:", e);
    return null;
  }

  const oauth = readPlatformYouTubeContentOAuth();
  const refreshed = oauth
    ? await refreshYouTubeContentAccessToken(oauth.clientId, oauth.clientSecret, refreshToken)
    : null;

  if (!refreshed?.access_token) {
    try {
      return await decryptYouTubeContentToken(String(tokenRow.access_token_enc));
    } catch {
      return null;
    }
  }

  const now = new Date().toISOString();
  const accessEnc = await encryptYouTubeContentToken(refreshed.access_token);
  const refreshEnc = refreshed.refresh_token
    ? await encryptYouTubeContentToken(refreshed.refresh_token)
    : String(tokenRow.refresh_token_enc);
  const accessExpires = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : tokenRow.access_token_expires_at;

  await admin.from("organization_youtube_content_connection_tokens").update({
    access_token_enc: accessEnc,
    refresh_token_enc: refreshEnc,
    access_token_expires_at: accessExpires,
    updated_at: now,
  }).eq("organization_id", organizationId).eq("channel_id", channelId);

  return refreshed.access_token;
}

export async function resolveOrgYouTubeContentForMetrics(
  admin: SupabaseClient,
  organizationId: string,
  channelIdParam?: string | null,
): Promise<{ accessToken: string; account: YouTubeContentAccountRow } | null> {
  let account: YouTubeContentAccountRow | null = null;

  if (channelIdParam) {
    const { data: row } = await admin
      .from("organization_youtube_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("channel_id", channelIdParam.trim())
      .maybeSingle();
    if (row) account = row as YouTubeContentAccountRow;
  }

  if (!account) {
    const { data: defaultRow } = await admin
      .from("organization_youtube_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();
    account = (defaultRow as YouTubeContentAccountRow | null) ?? null;
  }

  if (!account) {
    const { data: firstRow } = await admin
      .from("organization_youtube_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    account = (firstRow as YouTubeContentAccountRow | null) ?? null;
  }

  if (!account?.channel_id) return null;

  const accessToken = await getYouTubeContentAccessToken(admin, organizationId, account.channel_id);
  if (!accessToken) return null;

  return { accessToken, account };
}
