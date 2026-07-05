import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { parseAutomationFlowGraph } from "@/5-3-automation-flow/lib/graph/serializeGraph";
import type { AutomationFlowGraph } from "@/5-3-automation-flow/types/automationFlowGraph.types";
import type { AutomationFlowRecord } from "@/5-3-automation-flow/types/automationFlowRecord.types";
import { automationFlowListingQueryKey } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useAutomationFlowListing";

export const automationFlowQueryKey = (flowId: string | null | undefined) =>
  ["automation-flow", flowId] as const;

async function authFetch(path: string, init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  const url = `${SUPABASE_URL}/functions/v1/automation-flow-api${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : "Request failed");
  }
  return json;
}

export function useAutomationFlow(flowId: string | undefined) {
  return useQuery({
    queryKey: automationFlowQueryKey(flowId),
    enabled: Boolean(flowId),
    queryFn: async (): Promise<AutomationFlowRecord> => {
      const json = await authFetch(`/${encodeURIComponent(flowId!)}`);
      return (json as { flow: AutomationFlowRecord }).flow;
    },
  });
}

export function useSaveAutomationFlowGraph(flowId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (graph: AutomationFlowGraph) => {
      if (!flowId) throw new Error("Missing flow id");
      const json = await authFetch(`/${encodeURIComponent(flowId)}`, {
        method: "PATCH",
        body: JSON.stringify({ graph_json: parseAutomationFlowGraph(graph) }),
      });
      return (json as { flow: AutomationFlowRecord }).flow;
    },
    onSuccess: (flow) => {
      queryClient.setQueryData(automationFlowQueryKey(flowId), flow);
    },
  });
}

export function usePublishAutomationFlow(flowId: string | undefined) {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  return useMutation({
    mutationFn: async () => {
      if (!flowId) throw new Error("Missing flow id");
      const json = await authFetch(`/${encodeURIComponent(flowId)}/publish`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      return (json as { flow: AutomationFlowRecord }).flow;
    },
    onSuccess: (flow) => {
      queryClient.setQueryData(automationFlowQueryKey(flowId), flow);
      void queryClient.invalidateQueries({ queryKey: automationFlowListingQueryKey(organizationId) });
    },
  });
}

export function useUpdateAutomationFlowMeta(flowId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: { name?: string; re_enrollment_rule?: string }) => {
      if (!flowId) throw new Error("Missing flow id");
      const json = await authFetch(`/${encodeURIComponent(flowId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return (json as { flow: AutomationFlowRecord }).flow;
    },
    onSuccess: (flow) => {
      queryClient.setQueryData(automationFlowQueryKey(flowId), flow);
    },
  });
}
