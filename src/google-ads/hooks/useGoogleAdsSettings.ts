import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

async function invokeConfig(
  organizationId: string,
  action: string,
  extra?: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("google-ads-config", {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw error;
  const payload = data as { error?: string } | SettingsResponse;
  if (payload && "error" in payload && payload.error) {
    throw new Error(payload.error);
  }
  return payload;
}

export function useGoogleAdsSettings(organizationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["google-ads-settings", organizationId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      const data = await invokeConfig(organizationId, "getSettings");
      return data as SettingsResponse;
    },
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const startOAuth = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("google-ads-oauth-start", {
        body: { organization_id: organizationId },
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
