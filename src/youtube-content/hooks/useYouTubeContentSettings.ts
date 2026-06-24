import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type { YouTubeContentOAuthReturnPath } from "@/youtube-content/settings/youtubeContentSettingsPaths";

export type YouTubeContentAccountRow = {
  id: string;
  channel_id: string;
  label: string;
  display_name: string | null;
  thumbnail_url: string | null;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
  comments_scopes_granted?: boolean;
  upload_scopes_granted?: boolean;
};

export type YouTubePendingChannel = {
  channel_id: string;
  title: string;
  thumbnail_url: string | null;
};

type SettingsResponse = {
  connection: { organization_id: string; oauth_connected_at: string | null; is_active: boolean } | null;
  oauthConnected: boolean;
  accounts: YouTubeContentAccountRow[];
  serverConfigured?: boolean;
};

async function invokeConfig(
  organizationId: string,
  action: string,
  extra?: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("youtube-content-config", {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } | SettingsResponse;
  if (payload && "error" in payload && payload.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export function useYouTubeContentSettings(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const queryKey = ["youtube-content-settings", organizationId];

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
    mutationFn: async (returnPath?: YouTubeContentOAuthReturnPath) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("youtube-content-oauth-start", {
        body: {
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
    mutationFn: async (channelId?: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "disconnect", channelId ? { channel_id: channelId } : {});
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

  const getPendingChannels = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      const result = await invokeConfig(organizationId, "getPendingChannels");
      return result as { pending: boolean; channels: YouTubePendingChannel[] };
    },
  });

  const completeChannelConnect = useMutation({
    mutationFn: async (channelId: string) => {
      if (!organizationId) throw new Error("No organization");
      const result = await invokeConfig(organizationId, "completeChannelConnect", {
        channel_id: channelId,
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
    getPendingChannels,
    completeChannelConnect,
  };
}
