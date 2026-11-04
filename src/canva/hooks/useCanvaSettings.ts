import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type CanvaConnectionRow = {
  organization_id: string;
  canva_user_id: string | null;
  canva_team_id: string | null;
  display_name: string | null;
  is_active: boolean;
  oauth_connected_at: string | null;
  last_error: string | null;
  updated_at: string;
};

export type CanvaSettingsResponse = {
  oauthConfigured: boolean;
  encryptionReady: boolean;
  redirectUri: string;
  requiredScopes: string;
  oauthConnected: boolean;
  oauthScopes: string | null;
  connection: CanvaConnectionRow | null;
};

export type CanvaProbeResponse = {
  ok: boolean;
  toolCount?: number;
  toolNames?: string[];
  error?: string;
};

async function invokeConfig(
  organizationId: string,
  action: string,
): Promise<CanvaSettingsResponse | CanvaProbeResponse> {
  const { data, error } = await supabase.functions.invoke("canva-config", {
    body: { action, organization_id: organizationId },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } | CanvaSettingsResponse | CanvaProbeResponse;
  if (payload && typeof payload === "object" && "error" in payload && payload.error && !("ok" in payload)) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload as CanvaSettingsResponse | CanvaProbeResponse;
}

export function useCanvaSettings(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const gateEnabled = options?.enabled !== false;
  const queryClient = useQueryClient();
  const queryKey = ["canva-settings", organizationId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      return (await invokeConfig(organizationId, "getSettings")) as CanvaSettingsResponse;
    },
    enabled: Boolean(organizationId) && gateEnabled,
    staleTime: 30_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };

  const startOAuth = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("canva-oauth-start", {
        body: { organization_id: organizationId },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const url = (data as { url?: string; error?: string })?.url;
      if (!url) {
        throw new Error((data as { error?: string })?.error ?? "No OAuth URL");
      }
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

  const probe = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization");
      return (await invokeConfig(organizationId, "probe")) as CanvaProbeResponse;
    },
    onSuccess: invalidate,
  });

  return {
    ...query,
    startOAuth,
    disconnect,
    probe,
  };
}
