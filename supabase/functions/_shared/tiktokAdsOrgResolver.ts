import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decryptTikTokAdsToken,
  encryptTikTokAdsToken,
} from "./tiktokAdsConfigCrypto.ts";
import {
  readPlatformTikTokAdsOAuth,
  TIKTOK_ADS_API_BASE,
} from "./tiktokAdsAuth.ts";

export type TikTokAdsAccountRow = {
  id: string;
  organization_id: string;
  label: string;
  advertiser_id: string;
  pixel_code: string | null;
  is_default: boolean;
  is_active: boolean;
};

type TokenRow = {
  access_token_enc: string;
  refresh_token_enc: string;
  access_token_expires_at: string | null;
};

async function refreshTikTokAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token?: string; access_token_expires_in?: number } | null> {
  const oauth = readPlatformTikTokAdsOAuth();
  if (!oauth) return null;
  const res = await fetch(`${TIKTOK_ADS_API_BASE}/oauth2/refresh_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: oauth.appId,
      secret: oauth.appSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json().catch(() => ({})) as {
    code?: number;
    message?: string;
    data?: {
      access_token?: string;
      refresh_token?: string;
      access_token_expires_in?: number;
    };
  };
  if (!res.ok || json.code !== 0 || !json.data?.access_token) {
    console.error("tiktok refresh token:", json.message ?? res.status);
    return null;
  }
  return json.data;
}

export async function getTikTokAdsAccessToken(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data: row } = await admin
    .from("organization_tiktok_ads_connection_tokens")
    .select("access_token_enc, refresh_token_enc, access_token_expires_at")
    .eq("organization_id", organizationId)
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
      return await decryptTikTokAdsToken(String(tokenRow.access_token_enc));
    } catch (e) {
      console.error("getTikTokAdsAccessToken decrypt:", e);
    }
  }

  let refreshToken: string;
  try {
    refreshToken = await decryptTikTokAdsToken(String(tokenRow.refresh_token_enc));
  } catch (e) {
    console.error("getTikTokAdsAccessToken refresh decrypt:", e);
    return null;
  }

  const refreshed = await refreshTikTokAccessToken(refreshToken);
  if (!refreshed?.access_token) {
    try {
      return await decryptTikTokAdsToken(String(tokenRow.access_token_enc));
    } catch {
      return null;
    }
  }

  const now = new Date().toISOString();
  const accessEnc = await encryptTikTokAdsToken(refreshed.access_token);
  const refreshEnc = refreshed.refresh_token
    ? await encryptTikTokAdsToken(refreshed.refresh_token)
    : String(tokenRow.refresh_token_enc);
  const accessExpires = refreshed.access_token_expires_in
    ? new Date(Date.now() + refreshed.access_token_expires_in * 1000).toISOString()
    : tokenRow.access_token_expires_at;

  await admin.from("organization_tiktok_ads_connection_tokens").update({
    access_token_enc: accessEnc,
    refresh_token_enc: refreshEnc,
    access_token_expires_at: accessExpires,
    updated_at: now,
  }).eq("organization_id", organizationId);

  return refreshed.access_token;
}

export async function resolveOrgTikTokAdsForMetrics(
  admin: SupabaseClient,
  organizationId: string,
  advertiserId?: string | null,
): Promise<{ accessToken: string; account: TikTokAdsAccountRow } | null> {
  const accessToken = await getTikTokAdsAccessToken(admin, organizationId);
  if (!accessToken) return null;

  const { data: connection } = await admin
    .from("organization_tiktok_ads_connections")
    .select("oauth_connected_at")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!connection?.oauth_connected_at) return null;

  let account: TikTokAdsAccountRow | null = null;

  if (advertiserId) {
    const digits = advertiserId.replace(/\D/g, "");
    const { data: row } = await admin
      .from("organization_tiktok_ads_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("advertiser_id", digits)
      .maybeSingle();
    if (row) account = row as TikTokAdsAccountRow;
  }

  if (!account) {
    const { data: defaultRow } = await admin
      .from("organization_tiktok_ads_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();
    account = (defaultRow as TikTokAdsAccountRow | null) ?? null;
  }

  if (!account) return null;
  return { accessToken, account };
}
