import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type { TikTokContentOAuthReturnPath } from "@/tiktok-content/settings/tiktokContentSettingsPaths";

export type TikTokContentAccountRow = {
  id: string;
  open_id: string;
  label: string;
  display_name: string | null;
  avatar_url: string | null;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
  oauth_scopes?: string | null;
  oauth_token_kind?: string | null;
  comments_scopes_granted?: boolean;
  publish_scopes_granted?: boolean;
  publish_token_granted?: boolean;
};

type SettingsResponse = {
  connection: { organization_id: string; oauth_connected_at: string | null; is_active: boolean } | null;
  oauthConnected: boolean;
  accounts: TikTokContentAccountRow[];
  serverConfigured?: boolean;
};

async function invokeConfig(
  organizationId: string,
  action: string,
  extra?: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("tiktok-content-config", {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } | SettingsResponse;
  if (payload && "error" in payload && payload.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export function useTikTokContentSettings(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const queryKey = ["tiktok-content-settings", organizationId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      return (await invokeConfig(organizationId, "getSettings")) as SettingsResponse;
    },
    enabled: Boolean(organizationId) && options?.enabled !== false,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const startOAuth = useMutation({
    mutationFn: async (returnPath?: TikTokContentOAuthReturnPath) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("tiktok-content-oauth-start", {
        body: {
          organization_id: organizationId,
          oauth_purpose: "full",
          ...(returnPath ? { return_path: returnPath } : {}),
        },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error((data as { error?: string })?.error ?? "No OAuth URL");
      window.location.href = url;
    },
  });

  const startPublishOAuth = useMutation({
    mutationFn: async (params: { openId: string; returnPath?: TikTokContentOAuthReturnPath }) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("tiktok-content-oauth-start", {
        body: {
          organization_id: organizationId,
          oauth_purpose: "publish",
          open_id: params.openId,
          ...(params.returnPath ? { return_path: params.returnPath } : {}),
        },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error((data as { error?: string })?.error ?? "No OAuth URL");
      window.location.href = url;
    },
  });

  const disconnect = useMutation({
    mutationFn: async (openId?: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "disconnect", openId ? { open_id: openId } : {});
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

  const deleteAccount = useMutation({
    mutationFn: async (accountId: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "deleteAccount", { account_id: accountId });
    },
    onSuccess: invalidate,
  });

  return {
    ...query,
    startOAuth,
    startPublishOAuth,
    disconnect,
    setDefaultAccount,
    deleteAccount,
  };
}
