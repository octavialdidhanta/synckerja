import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type { TikTokAdsOAuthReturnPath } from "@/tiktok-ads/settings/tiktokAdsSettingsPaths";

export type TikTokAdsAccountRow = {
  id: string;
  label: string;
  advertiser_id: string;
  pixel_code: string | null;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
};

export type TikTokAdsConnectionRow = {
  organization_id: string;
  tiktok_user_id: string | null;
  is_active: boolean;
  oauth_connected_at: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
  updated_at: string;
};

type SettingsResponse = {
  connection: TikTokAdsConnectionRow | null;
  oauthConnected: boolean;
  accounts: TikTokAdsAccountRow[];
  serverConfigured?: boolean;
};

async function invokeConfig(
  organizationId: string,
  action: string,
  extra?: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("tiktok-ads-config", {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } | SettingsResponse;
  if (payload && "error" in payload && payload.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export type UseTikTokAdsSettingsOptions = {
  fetchSettings?: boolean;
  enabled?: boolean;
};

export function useTikTokAdsSettings(
  organizationId: string | null | undefined,
  options?: UseTikTokAdsSettingsOptions,
) {
  const fetchSettings = options?.fetchSettings !== false;
  const gateEnabled = options?.enabled !== false;
  const queryClient = useQueryClient();
  const queryKey = ["tiktok-ads-settings", organizationId];

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
    mutationFn: async (returnPath?: TikTokAdsOAuthReturnPath) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("tiktok-ads-oauth-start", {
        body: {
          organization_id: organizationId,
          ...(returnPath ? { return_path: returnPath } : {}),
        },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error((data as { error?: string })?.error ?? "No OAuth URL");
      window.location.href = url;
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
        queryKey: ["tiktok-ads-reporting-enabled", organizationId],
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
      advertiser_id: string;
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
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      return invokeConfig(organizationId, "testConnection");
    },
    onSuccess: invalidate,
  });

  const listAccessibleAdvertisers = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      const data = await invokeConfig(organizationId, "listAccessibleAdvertisers");
      return (
        (data as { advertisers?: Array<{ advertiser_id: string; name: string }> }).advertisers ??
        []
      );
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
    listAccessibleAdvertisers,
    syncAccessibleAccounts,
  };
}
