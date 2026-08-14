import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { whatsAppFlowsQueryKey } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useWhatsAppFlows";

function metaGraphErrorMessage(details: unknown): string | null {
  const err = (details as { error?: { error_user_msg?: string; message?: string } } | undefined)?.error;
  const userMsg = err?.error_user_msg?.trim();
  if (userMsg) return userMsg;
  const msg = err?.message?.trim();
  return msg || null;
}

async function deleteWhatsAppFlow(flowId: string): Promise<void> {
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
    body: JSON.stringify({ action: "delete", flow_id: flowId }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    details?: unknown;
  };
  if (!res.ok) {
    const metaMsg = metaGraphErrorMessage(json?.details);
    throw new Error(metaMsg ?? (typeof json.error === "string" ? json.error : "Failed to delete flow"));
  }
}

export function useDeleteWhatsAppFlows() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  return useMutation({
    mutationFn: async (flowIds: string[]) => {
      if (flowIds.length === 0) throw new Error("No flows selected");
      const results = await Promise.allSettled(flowIds.map((id) => deleteWhatsAppFlow(id)));
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        const reason = (failed[0] as PromiseRejectedResult).reason;
        throw new Error(reason instanceof Error ? reason.message : "Failed to delete flows");
      }
    },
    onSuccess: () => {
      if (organizationId) {
        void queryClient.invalidateQueries({ queryKey: whatsAppFlowsQueryKey(organizationId) });
      }
    },
  });
}
