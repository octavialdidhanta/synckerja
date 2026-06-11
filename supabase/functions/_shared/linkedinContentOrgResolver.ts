import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decryptLinkedInContentToken,
  encryptLinkedInContentToken,
} from "./linkedinContentConfigCrypto.ts";
import { readPlatformLinkedInContentOAuth } from "./linkedinContentAuth.ts";
import { refreshLinkedInContentAccessToken } from "./linkedinContentApi.ts";

export type LinkedInContentAccountRow = {
  id: string;
  organization_id: string;
  page_id: string;
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

export async function getLinkedInContentAccessToken(
  admin: SupabaseClient,
  organizationId: string,
  pageId: string,
): Promise<string | null> {
  const { data: row } = await admin
    .from("organization_linkedin_content_connection_tokens")
    .select("access_token_enc, refresh_token_enc, access_token_expires_at")
    .eq("organization_id", organizationId)
    .eq("page_id", pageId)
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
      return await decryptLinkedInContentToken(String(tokenRow.access_token_enc));
    } catch (e) {
      console.error("getLinkedInContentAccessToken decrypt:", e);
    }
  }

  let refreshToken: string;
  try {
    refreshToken = await decryptLinkedInContentToken(String(tokenRow.refresh_token_enc));
  } catch (e) {
    console.error("getLinkedInContentAccessToken refresh decrypt:", e);
    return null;
  }

  const oauth = readPlatformLinkedInContentOAuth();
  const refreshed = oauth
    ? await refreshLinkedInContentAccessToken(oauth.clientId, oauth.clientSecret, refreshToken)
    : null;

  if (!refreshed?.access_token) {
    try {
      return await decryptLinkedInContentToken(String(tokenRow.access_token_enc));
    } catch {
      return null;
    }
  }

  const now = new Date().toISOString();
  const accessEnc = await encryptLinkedInContentToken(refreshed.access_token);
  const refreshEnc = refreshed.refresh_token
    ? await encryptLinkedInContentToken(refreshed.refresh_token)
    : String(tokenRow.refresh_token_enc);
  const accessExpires = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : tokenRow.access_token_expires_at;

  await admin.from("organization_linkedin_content_connection_tokens").update({
    access_token_enc: accessEnc,
    refresh_token_enc: refreshEnc,
    access_token_expires_at: accessExpires,
    updated_at: now,
  }).eq("organization_id", organizationId).eq("page_id", pageId);

  return refreshed.access_token;
}

export async function resolveOrgLinkedInContentForMetrics(
  admin: SupabaseClient,
  organizationId: string,
  pageIdParam?: string | null,
): Promise<{ accessToken: string; account: LinkedInContentAccountRow } | null> {
  let account: LinkedInContentAccountRow | null = null;

  if (pageIdParam) {
    const { data: row } = await admin
      .from("organization_linkedin_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("page_id", pageIdParam.trim())
      .maybeSingle();
    if (row) account = row as LinkedInContentAccountRow;
  }

  if (!account) {
    const { data: defaultRow } = await admin
      .from("organization_linkedin_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();
    account = (defaultRow as LinkedInContentAccountRow | null) ?? null;
  }

  if (!account) {
    const { data: firstRow } = await admin
      .from("organization_linkedin_content_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    account = (firstRow as LinkedInContentAccountRow | null) ?? null;
  }

  if (!account?.page_id) return null;

  const accessToken = await getLinkedInContentAccessToken(admin, organizationId, account.page_id);
  if (!accessToken) return null;

  return { accessToken, account };
}
