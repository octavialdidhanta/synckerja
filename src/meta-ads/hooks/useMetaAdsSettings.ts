import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { markOfflineConversionOAuthStart } from "@/5-3-dashboard/omnichannel-settings/lib/offlineConversionOAuthResult";
import { parseEdgeFunctionError } from "@/meta-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type { MetaAdsOAuthReturnPath } from "@/meta-ads/settings/metaAdsSettingsPaths";

export type MetaAdsAccountRow = {
  id: string;
  label: string;
  ad_account_id: string;
  pixel_id: string;
  default_event_name: string;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
};

export type MetaAdsConnectionRow = {
  organization_id: string;
  meta_user_id: string | null;
  is_active: boolean;
  oauth_connected_at: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
  updated_at: string;
};

type SettingsResponse = {
  connection: MetaAdsConnectionRow | null;
  oauthConnected: boolean;
  accounts: MetaAdsAccountRow[];
};

async function invokeConfig(
  organizationId: string,
  action: string,
  extra?: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("meta-ads-config", {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } | SettingsResponse;
  if (payload && "error" in payload && payload.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export type UseMetaAdsSettingsOptions = {
  fetchSettings?: boolean;
  enabled?: boolean;
};

export function useMetaAdsSettings(
  organizationId: string | null | undefined,
  options?: UseMetaAdsSettingsOptions,
) {
  const fetchSettings = options?.fetchSettings !== false;
  const gateEnabled = options?.enabled !== false;
  const queryClient = useQueryClient();
  const queryKey = ["meta-ads-settings", organizationId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      return (await invokeConfig(organizationId, "getSettings")) as SettingsResponse;
    },
    enabled: Boolean(organizationId) && fetchSettings && gateEnabled,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const startOAuth = useMutation({
    mutationFn: async (returnPath?: MetaAdsOAuthReturnPath) => {
      if (!organizationId) throw new Error("No organization");
      markOfflineConversionOAuthStart("meta");
      const { data, error } = await supabase.functions.invoke("meta-ads-oauth-start", {
        body: {
          organization_id: organizationId,
          ...(returnPath ? { return_path: returnPath } : {}),
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as {
        url?: string;
        config_id?: string;
        error?: string;
        message?: string;
        required_scopes?: string[];
        redirect_uri?: string;
      };
      if (payload?.error === "META_ADS_OAUTH_CONFIG_ID_REQUIRED") {
        const scopes = (payload.required_scopes ?? []).join(", ");
        throw new Error(
          [
            payload.message ??
              "Meta Ads OAuth needs a dedicated Facebook Login for Business configuration.",
            scopes ? `Required permissions: ${scopes}.` : "",
            payload.redirect_uri
              ? `Add this redirect URI in the Meta config: ${payload.redirect_uri}`
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        );
      }
      if (payload?.error) throw await parseEdgeFunctionError(null, payload);
      const url = payload?.url;
      if (!url) throw new Error(payload?.error ?? "No OAuth URL");
      // Guard: never open Page/Instagram content configs for Meta Ads connect.
      const configId = String(payload.config_id ?? "").trim();
      const expectedAdsConfigId = "1816995849618665";
      if (!configId) {
        throw new Error("Meta Ads OAuth returned no config_id. Set META_ADS_OAUTH_CONFIG_ID.");
      }
      if (configId !== expectedAdsConfigId) {
        throw new Error(
          `Wrong Meta Ads OAuth config_id (${configId}). Expected ${expectedAdsConfigId} (Synckerja Meta Ads).`,
        );
      }
      try {
        const parsed = new URL(url);
        if (parsed.searchParams.get("config_id") !== expectedAdsConfigId) {
          throw new Error("OAuth URL config_id mismatch — refusing to open wrong Meta dialog.");
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("config_id")) throw e;
        throw new Error("Invalid Meta Ads OAuth URL");
      }
      toast.message(`Meta Ads OAuth config ${configId}`, { duration: 4000 });
      window.location.href = url;
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : String(err), { duration: 16000 });
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "disconnect");
    },
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({
        queryKey: ["meta-ads-reporting-enabled", organizationId],
      });
    },
  });

  const updateConnection = useMutation({
    mutationFn: async (input: { is_active?: boolean }) => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "updateConnection", input);
    },
    onSuccess: invalidate,
  });

  const upsertAccount = useMutation({
    mutationFn: async (input: {
      id?: string;
      label: string;
      ad_account_id: string;
      pixel_id: string;
      default_event_name?: string;
      is_default?: boolean;
      is_active?: boolean;
    }) => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "upsertAccount", input);
    },
    onSuccess: invalidate,
  });

  const deleteAccount = useMutation({
    mutationFn: async (accountId: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "deleteAccount", { account_id: accountId });
    },
    onSuccess: invalidate,
  });

  const setDefaultAccount = useMutation({
    mutationFn: async (accountId: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "setDefaultAccount", { account_id: accountId });
    },
    onSuccess: invalidate,
  });

  const testConnection = useMutation({
    mutationFn: async (accountId?: string) => {
      if (!organizationId) throw new Error("No organization");
      return invokeConfig(organizationId, "testConnection", accountId ? { account_id: accountId } : {});
    },
    onSuccess: invalidate,
  });

  const listAccessibleAdAccounts = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      const data = await invokeConfig(organizationId, "listAccessibleAdAccounts");
      return (data as { adAccounts?: Array<{ account_id: string; name: string; currency: string }> })
        .adAccounts ?? [];
    },
  });

  const listPixels = useMutation({
    mutationFn: async (adAccountId: string) => {
      if (!organizationId) throw new Error("No organization");
      const data = await invokeConfig(organizationId, "listPixels", { ad_account_id: adAccountId });
      return (data as { pixels?: Array<{ id: string; name: string }> }).pixels ?? [];
    },
  });

  const syncAccessibleAccounts = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      return invokeConfig(organizationId, "syncAccessibleAccounts");
    },
    onSuccess: invalidate,
  });

  return {
    ...query,
    startOAuth,
    disconnect,
    updateConnection,
    upsertAccount,
    deleteAccount,
    setDefaultAccount,
    testConnection,
    listAccessibleAdAccounts,
    listPixels,
    syncAccessibleAccounts,
  };
}
