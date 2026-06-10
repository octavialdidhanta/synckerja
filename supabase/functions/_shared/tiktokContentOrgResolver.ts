import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decryptTikTokContentToken,
  encryptTikTokContentToken,
} from "./tiktokContentConfigCrypto.ts";
import { readPlatformTikTokContentOAuth } from "./tiktokContentAuth.ts";
import { refreshTikTokContentAccessToken } from "./tiktokContentApi.ts";

export type TikTokContentAccountRow = {
  id: string;
  organization_id: string;
  open_id: string;
  label: string;
  display_name: string | null;
  avatar_url: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

type TokenRow = {
  access_token_enc: string;
  refresh_token_enc: string;
  access_token_expires_at: string | null;
};

export async function getTikTokContentAccessToken(
  admin: SupabaseClient,
  organizationId: string,
  openId: string,
): Promise<string | null> {
  const { data: row } = await admin
    .from("organization_tiktok_content_connection_tokens")
    .select("access_token_enc, refresh_token_enc, access_token_expires_at")
    .eq("organization_id", organizationId)
    .eq("open_id", openId)
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
      return await decryptTikTokContentToken(String(tokenRow.access_token_enc));
    } catch (e) {
      console.error("getTikTokContentAccessToken decrypt:", e);
    }
  }

  let refreshToken: string;
  try {
    refreshToken = await decryptTikTokContentToken(String(tokenRow.refresh_token_enc));
  } catch (e) {
    console.error("getTikTokContentAccessToken refresh decrypt:", e);
    return null;
  }

  const oauth = readPlatformTikTokContentOAuth();
  const refreshed = oauth
    ? await refreshTikTokContentAccessToken(oauth.clientKey, oauth.clientSecret, refreshToken)
    : null;

  if (!refreshed?.access_token) {
    try {
      return await decryptTikTokContentToken(String(tokenRow.access_token_enc));
    } catch {
      return null;
    }
  }

  const now = new Date().toISOString();
  const accessEnc = await encryptTikTokContentToken(refreshed.access_token);
  const refreshEnc = refreshed.refresh_token
    ? await encryptTikTokContentToken(refreshed.refresh_token)
    : String(tokenRow.refresh_token_enc);
  const accessExpires = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : tokenRow.access_token_expires_at;

  await admin.from("organization_tiktok_content_connection_tokens").update({
    access_token_enc: accessEnc,
    refresh_token_enc: refreshEnc,
    access_token_expires_at: accessExpires,
    updated_at: now,
  }).eq("organization_id", organizationId).eq("open_id", openId);

  return refreshed.access_token;
}

export async function resolveOrgTikTokContentForMetrics(
  admin: SupabaseClient,
  organizationId: string,
  openIdParam?: string | null,
): Promise<{ accessToken: string; account: TikTokContentAccountRow } | null> {
  let account: TikTokContentAccountRow | null = null;

  if (openIdParam) {
    const { data: row } = await admin
      .from("organization_tiktok_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("open_id", openIdParam.trim())
      .maybeSingle();
    if (row) account = row as TikTokContentAccountRow;
  }

  if (!account) {
    const { data: defaultRow } = await admin
      .from("organization_tiktok_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();
    account = (defaultRow as TikTokContentAccountRow | null) ?? null;
  }

  if (!account) {
    const { data: firstRow } = await admin
      .from("organization_tiktok_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    account = (firstRow as TikTokContentAccountRow | null) ?? null;
  }

  if (!account?.open_id) return null;

  const accessToken = await getTikTokContentAccessToken(admin, organizationId, account.open_id);
  if (!accessToken) return null;

  return { accessToken, account };
}
