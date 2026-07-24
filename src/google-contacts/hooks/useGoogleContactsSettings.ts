import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type { GoogleContactsOAuthReturnPath } from "@/google-contacts/settings/googleContactsSettingsPaths";

export type GoogleContactsConnectionRow = {
  organization_id: string;
  google_account_email: string | null;
  is_active: boolean;
  oauth_connected_at: string | null;
  updated_at: string;
};

type SettingsResponse = {
  connection: GoogleContactsConnectionRow | null;
  oauthConnected: boolean;
  oauthScopes: string | null;
  pendingJobs: number;
  syncedContacts: number;
};

async function invokeConfig(
  organizationId: string,
  action: string,
  extra?: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("google-contacts-config", {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } | SettingsResponse;
  if (payload && "error" in payload && payload.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export function useGoogleContactsSettings(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const gateEnabled = options?.enabled !== false;
  const queryClient = useQueryClient();
  const queryKey = ["google-contacts-settings", organizationId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      const data = await invokeConfig(organizationId, "getSettings");
      return data as SettingsResponse;
    },
    enabled: Boolean(organizationId) && gateEnabled,
    staleTime: 30_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
    if (organizationId) {
      void queryClient.invalidateQueries({
        queryKey: ["google-contacts-connected", organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["google-contacts-sync-links", organizationId],
      });
    }
  };

  const startOAuth = useMutation({
    mutationFn: async (returnPath?: GoogleContactsOAuthReturnPath) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("google-contacts-oauth-start", {
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

  const enqueueBackfill = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      const data = await invokeConfig(organizationId, "enqueueBackfill");
      return data as { enqueued?: number };
    },
    onSuccess: invalidate,
  });

  return {
    ...query,
    startOAuth,
    disconnect,
    enqueueBackfill,
  };
}
