import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOrganizationOmnichannelStaff } from "@/shared/hooks/useOrganizationOmnichannelStaff";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import {
  buildEmployeeLookup,
  mapAutomationFlowToRow,
} from "@/5-3-dashboard/omnichannel-settings/lib/flow-builder/mapAutomationFlowToRow";
import type { FlowBuilderListingRow } from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";
import type { AutomationFlowRecord } from "@/5-3-automation-flow/types/automationFlowRecord.types";
import {
  buildGraphForTemplate,
  type FlowTemplateId,
} from "@/5-3-automation-flow/lib/graph/flowTemplateGraphs";

export const automationFlowListingQueryKey = (organizationId: string | null | undefined) =>
  ["automation-flow-listing", organizationId] as const;

async function fetchAutomationFlows(): Promise<AutomationFlowRecord[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const url = `${SUPABASE_URL}/functions/v1/automation-flow-api`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    flows?: AutomationFlowRecord[];
  };
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : "Failed to load automation flows");
  }
  return Array.isArray(json.flows) ? json.flows : [];
}

export function useAutomationFlowListing() {
  const { organizationId } = useCurrentOrg();
  const { data: staffRows = [] } = useOrganizationOmnichannelStaff();

  return useQuery({
    queryKey: automationFlowListingQueryKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<FlowBuilderListingRow[]> => {
      const flows = await fetchAutomationFlows();
      const employeeLookup = buildEmployeeLookup(staffRows);
      return flows.map((flow) => mapAutomationFlowToRow(flow, employeeLookup));
    },
    staleTime: 15_000,
  });
}

async function deleteAutomationFlow(flowId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const url = `${SUPABASE_URL}/functions/v1/automation-flow-api/${encodeURIComponent(flowId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : "Failed to delete flow");
  }
}

export function useDeleteAutomationFlows() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  return useMutation({
    mutationFn: async (flowIds: string[]) => {
      if (flowIds.length === 0) throw new Error("No flows selected");
      const results = await Promise.allSettled(flowIds.map((id) => deleteAutomationFlow(id)));
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        const reason = (failed[0] as PromiseRejectedResult).reason;
        throw new Error(reason instanceof Error ? reason.message : "Failed to delete flows");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationFlowListingQueryKey(organizationId) });
    },
  });
}

export function useCreateAutomationFlow() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  return useMutation({
    mutationFn: async (input: { name: string; template?: FlowTemplateId }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const template = input.template ?? "scratch";
      const url = `${SUPABASE_URL}/functions/v1/automation-flow-api`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: input.name,
          template,
          graph_json: buildGraphForTemplate(template),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        flow?: AutomationFlowRecord;
      };
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed to create flow");
      }
      return json.flow!;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationFlowListingQueryKey(organizationId) });
    },
  });
}
