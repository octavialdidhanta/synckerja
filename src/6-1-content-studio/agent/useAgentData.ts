import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import type { AgentDeviceRow, AgentTokenRow } from "./agentData";

// agent_* tables are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any;
const db = () => supabase as LooseClient;

const devicesKey = (org: string | null | undefined) => ["content-studio", "agent-devices", org] as const;
const tokensKey = (org: string | null | undefined) => ["content-studio", "agent-tokens", org] as const;

/** Devices serving the active organization. Refreshes every 30 s so online/offline stays honest. */
export function useAgentDevices() {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<AgentDeviceRow[]>({
    queryKey: devicesKey(organizationId),
    enabled: Boolean(organizationId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db()
        .from("agent_device_orgs")
        .select("device_id,last_seen_at,agent_devices(id,name,agent_version,platform,tools,last_error,last_seen_at)")
        .eq("organization_id", organizationId)
        .order("last_seen_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgentDeviceRow[];
    },
  });
}

/** Tokens of the active organization. Members who are not owner/admin get an empty list (RLS). */
export function useAgentTokens() {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<AgentTokenRow[]>({
    queryKey: tokensKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await db()
        .from("agent_tokens")
        .select("id,token_prefix,label,scopes,created_at,expires_at,revoked_at,last_used_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgentTokenRow[];
    },
  });
}

export interface CreatedToken {
  id: string;
  token: string;
  token_prefix: string;
  expires_at: string;
}

export function useAgentTokenActions() {
  const qc = useQueryClient();
  const { organizationId } = useOrgBootstrapPending();
  const refresh = () => qc.invalidateQueries({ queryKey: tokensKey(organizationId) });

  const create = useMutation({
    mutationFn: async (v: { label: string; days: number }): Promise<CreatedToken> => {
      const { data, error } = await db().rpc("agent_token_create", {
        p_organization_id: organizationId,
        p_label: v.label,
        p_expires_in_days: v.days,
      });
      if (error) throw new Error(error.message);
      return data as CreatedToken;
    },
    onSuccess: refresh,
  });

  const revoke = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await db().rpc("agent_token_revoke", { p_token_id: tokenId });
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });

  return { create, revoke };
}
