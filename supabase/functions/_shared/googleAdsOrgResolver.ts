import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptGoogleAdsRefreshToken } from "./googleAdsConfigCrypto.ts";
import {
  type GoogleAdsConfig,
  readGoogleAdsConfig,
} from "../google-ads-upload-offline-conversion/googleAdsHelpers.ts";

export type ResolvedGoogleAdsAccount = {
  accountId: string;
  customerId: string;
  conversionActionId: string;
};

export type ResolvedOrgGoogleAds = {
  config: GoogleAdsConfig;
  account: ResolvedGoogleAdsAccount;
  source: "per_org" | "legacy_global";
};

const LEGACY_SEED_ORG_ID = "663c9336-8cb6-4a36-9ad9-313126e70a1a";

function legacyFallbackEnabled(): boolean {
  return (Deno.env.get("GOOGLE_ADS_LEGACY_GLOBAL_FALLBACK") ?? "").trim().toLowerCase() === "true";
}

async function loadAccountRow(
  admin: SupabaseClient,
  organizationId: string,
  accountId: string | null,
): Promise<ResolvedGoogleAdsAccount | null> {
  if (accountId) {
    const { data } = await admin
      .from("organization_google_ads_accounts")
      .select("id, customer_id, conversion_action_id, is_active")
      .eq("id", accountId)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .maybeSingle();
    if (data?.id) {
      return {
        accountId: String(data.id),
        customerId: String(data.customer_id).replace(/\D/g, ""),
        conversionActionId: String(data.conversion_action_id).replace(/\D/g, ""),
      };
    }
  }

  const { data: defaultRow } = await admin
    .from("organization_google_ads_accounts")
    .select("id, customer_id, conversion_action_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();

  if (defaultRow?.id) {
    return {
      accountId: String(defaultRow.id),
      customerId: String(defaultRow.customer_id).replace(/\D/g, ""),
      conversionActionId: String(defaultRow.conversion_action_id).replace(/\D/g, ""),
    };
  }

  const { data: first } = await admin
    .from("organization_google_ads_accounts")
    .select("id, customer_id, conversion_action_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!first?.id) return null;
  return {
    accountId: String(first.id),
    customerId: String(first.customer_id).replace(/\D/g, ""),
    conversionActionId: String(first.conversion_action_id).replace(/\D/g, ""),
  };
}

export type ResolveOrgGoogleAdsOptions = {
  /** When false, allow test/list APIs while uploads toggle is off. Uploads still require is_active. */
  requireUploadsEnabled?: boolean;
};

export async function resolveOrgGoogleAdsForUpload(
  admin: SupabaseClient,
  organizationId: string,
  leadGoogleAdsAccountId: string | null,
  options?: ResolveOrgGoogleAdsOptions,
): Promise<ResolvedOrgGoogleAds | null> {
  const requireUploadsEnabled = options?.requireUploadsEnabled !== false;
  const platform = {
    clientId: Deno.env.get("GOOGLE_ADS_CLIENT_ID")?.trim() ?? "",
    clientSecret: Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")?.trim() ?? "",
    developerToken: Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")?.trim() ?? "",
  };
  if (!platform.clientId || !platform.clientSecret || !platform.developerToken) {
    return null;
  }

  const { data: connection } = await admin
    .from("organization_google_ads_connections")
    .select("organization_id, login_customer_id, is_active, oauth_connected_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (
    connection?.oauth_connected_at &&
    (!requireUploadsEnabled || connection.is_active)
  ) {
    const { data: tokenRow } = await admin
      .from("organization_google_ads_connection_tokens")
      .select("refresh_token_enc")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (tokenRow?.refresh_token_enc) {
      const account = await loadAccountRow(admin, organizationId, leadGoogleAdsAccountId);
      if (!account) return null;

      let refreshToken: string;
      try {
        refreshToken = await decryptGoogleAdsRefreshToken(String(tokenRow.refresh_token_enc));
      } catch (e) {
        console.error("resolveOrgGoogleAdsForUpload decrypt:", e);
        return null;
      }

      const loginRaw = connection.login_customer_id != null
        ? String(connection.login_customer_id).trim()
        : "";
      const loginCustomerId = loginRaw ? loginRaw.replace(/\D/g, "") : null;

      return {
        source: "per_org",
        account,
        config: {
          clientId: platform.clientId,
          clientSecret: platform.clientSecret,
          refreshToken,
          developerToken: platform.developerToken,
          customerId: account.customerId,
          conversionActionId: account.conversionActionId,
          loginCustomerId,
        },
      };
    }
  }

  if (!legacyFallbackEnabled()) return null;
  const legacy = readGoogleAdsConfig();
  if (!legacy) return null;
  if (organizationId !== LEGACY_SEED_ORG_ID) return null;

  return {
    source: "legacy_global",
    account: {
      accountId: "legacy-global",
      customerId: legacy.customerId,
      conversionActionId: legacy.conversionActionId,
    },
    config: legacy,
  };
}

export async function isOrgGoogleAdsConfigured(
  admin: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  const { data } = await admin.rpc("is_google_ads_integration_enabled", {
    p_organization_id: organizationId,
  });
  if (data === true) return true;
  if (legacyFallbackEnabled() && organizationId === LEGACY_SEED_ORG_ID) {
    return readGoogleAdsConfig() != null;
  }
  return false;
}
