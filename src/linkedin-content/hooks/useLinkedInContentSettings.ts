import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type { LinkedInContentOAuthReturnPath } from "@/linkedin-content/settings/linkedinContentSettingsPaths";

export type LinkedInContentAccountRow = {
  id: string;
  page_id: string;
  label: string;
  display_name: string | null;
  thumbnail_url: string | null;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
};

export type LinkedInPendingPage = {
  page_id: string;
  title: string;
  thumbnail_url: string | null;
};

type SettingsResponse = {
  connection: { organization_id: string; oauth_connected_at: string | null; is_active: boolean } | null;
  oauthConnected: boolean;
  accounts: LinkedInContentAccountRow[];
  serverConfigured?: boolean;
};

async function invokeLinkedInApi(
  organizationId: string,
  action: string,
  extra?: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("linkedin-content-api", {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } | SettingsResponse;
  if (payload && "error" in payload && payload.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export function useLinkedInContentSettings(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const queryKey = ["linkedin-content-settings", organizationId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      return (await invokeLinkedInApi(organizationId, "getSettings")) as SettingsResponse;
    },
    enabled: Boolean(organizationId) && options?.enabled !== false,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const startOAuth = useMutation({
    mutationFn: async (returnPath?: LinkedInContentOAuthReturnPath) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("linkedin-content-api", {
        body: {
          action: "oauthStart",
          organization_id: organizationId,
          ...(returnPath ? { return_path: returnPath } : {}),
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as { url?: string; error?: string };
      if (payload?.error) throw await parseEdgeFunctionError(null, payload);
      const url = payload?.url;
      if (!url) throw new Error("No OAuth URL returned from server");
      window.location.href = url;
    },
  });

  const disconnect = useMutation({
    mutationFn: async (pageId?: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeLinkedInApi(organizationId, "disconnect", pageId ? { page_id: pageId } : {});
    },
    onSuccess: invalidate,
  });

  const setDefaultAccount = useMutation({
    mutationFn: async (accountId: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeLinkedInApi(organizationId, "setDefaultAccount", { account_id: accountId });
    },
    onSuccess: invalidate,
  });

  const deleteAccount = useMutation({
    mutationFn: async (accountId: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeLinkedInApi(organizationId, "deleteAccount", { account_id: accountId });
    },
    onSuccess: invalidate,
  });

  const getPendingPages = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      const result = await invokeLinkedInApi(organizationId, "getPendingPages");
      return result as { pending: boolean; pages: LinkedInPendingPage[] };
    },
  });

  const completePageConnect = useMutation({
    mutationFn: async (pageId: string) => {
      if (!organizationId) throw new Error("No organization");
      const result = await invokeLinkedInApi(organizationId, "completePageConnect", {
        page_id: pageId,
      });
      return result as { ok: boolean; isExistingAccount?: boolean };
    },
    onSuccess: invalidate,
  });

  return {
    ...query,
    startOAuth,
    disconnect,
    setDefaultAccount,
    deleteAccount,
    getPendingPages,
    completePageConnect,
  };
}
