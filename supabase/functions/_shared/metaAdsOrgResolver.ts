import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptMetaAdsAccessToken } from "./metaAdsConfigCrypto.ts";

export type MetaAdsAccountRow = {
  id: string;
  organization_id: string;
  label: string;
  ad_account_id: string;
  pixel_id: string;
  default_event_name: string;
  is_default: boolean;
  is_active: boolean;
};

export type MetaAdsRuntimeConfig = {
  accessToken: string;
  account: MetaAdsAccountRow;
  uploadsEnabled: boolean;
};

function actId(adAccountId: string): string {
  const digits = adAccountId.replace(/\D/g, "");
  return digits.startsWith("act_") ? digits : `act_${digits}`;
}

export { actId as metaActId };

export async function getMetaAdsAccessToken(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data: row } = await admin
    .from("organization_meta_ads_connection_tokens")
    .select("access_token_enc")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!row?.access_token_enc) return null;
  try {
    return await decryptMetaAdsAccessToken(String(row.access_token_enc));
  } catch (e) {
    console.error("getMetaAdsAccessToken decrypt:", e);
    return null;
  }
}

export async function resolveOrgMetaAdsForUpload(
  admin: SupabaseClient,
  organizationId: string,
  leadAccountId: string | null,
  options?: { requireUploadsEnabled?: boolean },
): Promise<MetaAdsRuntimeConfig | null> {
  const requireUploads = options?.requireUploadsEnabled !== false;

  const { data: connection } = await admin
    .from("organization_meta_ads_connections")
    .select("organization_id, is_active, oauth_connected_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!connection?.oauth_connected_at) return null;
  if (requireUploads && !connection.is_active) return null;

  const accessToken = await getMetaAdsAccessToken(admin, organizationId);
  if (!accessToken) return null;

  let account: MetaAdsAccountRow | null = null;

  if (leadAccountId) {
    const { data: override } = await admin
      .from("organization_meta_ads_accounts")
      .select("*")
      .eq("id", leadAccountId)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .maybeSingle();
    if (override) account = override as MetaAdsAccountRow;
  }

  if (!account) {
    const { data: defaultRow } = await admin
      .from("organization_meta_ads_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();
    account = (defaultRow as MetaAdsAccountRow | null) ?? null;
  }

  if (!account) {
    const { data: first } = await admin
      .from("organization_meta_ads_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    account = (first as MetaAdsAccountRow | null) ?? null;
  }

  if (!account?.pixel_id) return null;

  return {
    accessToken,
    account,
    uploadsEnabled: Boolean(connection.is_active),
  };
}

export async function resolveOrgMetaAdsForMetrics(
  admin: SupabaseClient,
  organizationId: string,
  adAccountId?: string | null,
): Promise<{ accessToken: string; account: MetaAdsAccountRow } | null> {
  const accessToken = await getMetaAdsAccessToken(admin, organizationId);
  if (!accessToken) return null;

  const { data: connection } = await admin
    .from("organization_meta_ads_connections")
    .select("oauth_connected_at")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!connection?.oauth_connected_at) return null;

  let account: MetaAdsAccountRow | null = null;

  if (adAccountId) {
    const digits = adAccountId.replace(/\D/g, "");
    const { data: row } = await admin
      .from("organization_meta_ads_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("ad_account_id", digits)
      .maybeSingle();
    if (row) account = row as MetaAdsAccountRow;
  }

  if (!account) {
    const { data: defaultRow } = await admin
      .from("organization_meta_ads_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();
    account = (defaultRow as MetaAdsAccountRow | null) ?? null;
  }

  if (!account) return null;
  return { accessToken, account };
}
