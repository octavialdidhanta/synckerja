import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { whatsAppFlowsQueryKey } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useWhatsAppFlows";

export type WhatsAppFlowDetail = {
  id: string;
  name: string;
  status: string;
  categories?: string[];
  updated_at?: string | null;
};

export const whatsAppFlowDetailQueryKey = (
  organizationId: string | null | undefined,
  flowId: string | null | undefined,
) => ["whatsapp-flow-detail", organizationId, flowId] as const;

function metaGraphErrorMessage(details: unknown): string | null {
  const err = (details as { error?: { error_user_msg?: string; message?: string } } | undefined)?.error;
  const userMsg = err?.error_user_msg?.trim();
  if (userMsg) return userMsg;
  const msg = err?.message?.trim();
  return msg || null;
}

async function fetchWhatsAppFlowDetail(flowId: string): Promise<{
  flow: WhatsAppFlowDetail;
  flow_json: Record<string, unknown> | null;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const url = `${SUPABASE_URL}/functions/v1/whatsapp-flows?flow_id=${encodeURIComponent(flowId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    details?: unknown;
    flow?: WhatsAppFlowDetail;
    flow_json?: Record<string, unknown> | null;
  };
  if (!res.ok) {
    const metaMsg = metaGraphErrorMessage(json?.details);
    throw new Error(metaMsg ?? (typeof json.error === "string" ? json.error : "Failed to load flow"));
  }
  const flow = json.flow;
  if (!flow?.id) throw new Error("Invalid flow detail response");
  return {
    flow: {
      id: String(flow.id),
      name: String(flow.name ?? ""),
      status: String(flow.status ?? ""),
      categories: Array.isArray(flow.categories) ? flow.categories.map(String) : undefined,
      updated_at: flow.updated_at ?? null,
    },
    flow_json: json.flow_json ?? null,
  };
}

export function useWhatsAppFlowDetail(flowId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: whatsAppFlowDetailQueryKey(organizationId, flowId),
    enabled: Boolean(organizationId && flowId),
    queryFn: () => fetchWhatsAppFlowDetail(flowId!),
    staleTime: 15_000,
  });
}

export function useUpdateWhatsAppFlow() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  return useMutation({
    mutationFn: async (payload: {
      flow_id: string;
      flow_json: Record<string, unknown> | string;
      name?: string;
      categories?: string[];
    }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-flows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "update", ...payload }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: unknown;
        result?: Record<string, unknown> & { validation_errors?: unknown[]; success?: boolean };
      };
      if (!res.ok) {
        const metaMsg = metaGraphErrorMessage(json?.details);
        throw new Error(metaMsg ?? (typeof json.error === "string" ? json.error : "Failed to update flow"));
      }
      const result = json.result;
      const ve = result?.validation_errors;
      if (Array.isArray(ve) && ve.length > 0) {
        const veMsg = ve
          .map((e) => {
            if (e != null && typeof e === "object" && "message" in e) {
              return String((e as { message?: string }).message ?? e);
            }
            return typeof e === "string" ? e : JSON.stringify(e);
          })
          .join(" · ");
        throw new Error(veMsg ? `Meta validation: ${veMsg}` : "Meta rejected the flow update");
      }
      return result ?? {};
    },
    onSuccess: (_data, variables) => {
      if (organizationId) {
        void queryClient.invalidateQueries({ queryKey: whatsAppFlowsQueryKey(organizationId) });
        void queryClient.invalidateQueries({
          queryKey: whatsAppFlowDetailQueryKey(organizationId, variables.flow_id),
        });
      }
    },
  });
}
