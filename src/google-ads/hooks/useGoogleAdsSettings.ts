import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { markOfflineConversionOAuthStart } from "@/5-3-dashboard/omnichannel-settings/lib/offlineConversionOAuthResult";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type GoogleAdsAccountRow = {
  id: string;
  label: string;
  customer_id: string;
  conversion_action_id: string;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
};

export type GoogleAdsConnectionRow = {
  organization_id: string;
  login_customer_id: string | null;
  is_active: boolean;
  oauth_connected_at: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
  updated_at: string;
};

type SettingsResponse = {
  connection: GoogleAdsConnectionRow | null;
  oauthConnected: boolean;
  accounts: GoogleAdsAccountRow[];
};

function shouldRetryGoogleAdsConfig(error: unknown): boolean {
  const err = error as { context?: Response; message?: string };
  const status = err.context?.status;
  if (status != null && status >= 400 && status < 500) return false;
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (/Connect Google Ads first|Forbidden|Unauthorized|Unknown action|Missing organization/i.test(msg)) {
    return false;
  }
  return true;
}

async function invokeConfig(
  organizationId: string,
  action: string,
  extra?: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("google-ads-config", {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } | SettingsResponse;
  if (payload && "error" in payload && payload.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export type UseGoogleAdsSettingsOptions = {
  /** When false, skip getSettings (e.g. metrics page only needs sync mutation). */
  fetchSettings?: boolean;
  /** When false, disable server calls until org/admin gate passes. */
  enabled?: boolean;
};

export function useGoogleAdsSettings(
  organizationId: string | null | undefined,
  options?: UseGoogleAdsSettingsOptions,
) {
  const fetchSettings = options?.fetchSettings !== false;
  const gateEnabled = options?.enabled !== false;
  const queryClient = useQueryClient();
  const queryKey = ["google-ads-settings", organizationId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      const data = await invokeConfig(organizationId, "getSettings");
      return data as SettingsResponse;
    },
    enabled: Boolean(organizationId) && fetchSettings && gateEnabled,
    staleTime: 30_000,
    retry: (failureCount, error) => shouldRetryGoogleAdsConfig(error) && failureCount < 2,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
    if (organizationId) {
      void queryClient.invalidateQueries({
        queryKey: ["google-ads-integration-enabled", organizationId],
      });
      void queryClient.invalidateQueries({ queryKey: ["google-ads-connected", organizationId] });
      void queryClient.invalidateQueries({
        queryKey: ["google-ads-reporting-enabled", organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["google-ads-accounts-picker-metrics", organizationId],
      });
    }
  };

  const startOAuth = useMutation({
    mutationFn: async (returnPath?: string) => {
      if (!organizationId) throw new Error("No organization");
      markOfflineConversionOAuthStart("google");
      const { data, error } = await supabase.functions.invoke("google-ads-oauth-start", {
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
    onSuccess: invalidate,
  });

  const updateConnection = useMutation({
    mutationFn: async (input: { login_customer_id?: string | null; is_active?: boolean }) => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "updateConnection", input);
    },
    onSuccess: invalidate,
  });

  const upsertAccount = useMutation({
    mutationFn: async (input: {
      id?: string;
      label: string;
      customer_id: string;
      conversion_action_id: string;
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

  const listAccessibleCustomers = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      const data = await invokeConfig(organizationId, "listAccessibleCustomers");
      return (data as { customerIds?: string[] }).customerIds ?? [];
    },
  });

  const listConversionActions = useMutation({
    mutationFn: async (customerId: string) => {
      if (!organizationId) throw new Error("No organization");
      const data = await invokeConfig(organizationId, "listConversionActions", { customer_id: customerId });
      return (data as { conversionActions?: { id: string; name: string }[] }).conversionActions ?? [];
    },
  });

  const importLegacy = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "importLegacyEnvSecrets");
    },
    onSuccess: invalidate,
  });

  const syncAccessibleAccounts = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      const data = await invokeConfig(organizationId, "syncAccessibleAccounts");
      return data as {
        imported?: number;
        skipped?: Array<{ customer_id: string; reason: string }>;
        accounts?: unknown[];
      };
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
    listAccessibleCustomers,
    listConversionActions,
    importLegacy,
    syncAccessibleAccounts,
  };
}
