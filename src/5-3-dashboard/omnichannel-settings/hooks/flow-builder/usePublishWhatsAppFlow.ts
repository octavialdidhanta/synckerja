import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { whatsAppFlowsQueryKey } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useWhatsAppFlows";

export function usePublishWhatsAppFlow() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flowId: string) => {
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
        body: JSON.stringify({ action: "publish", flow_id: flowId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed to publish flow");
      }
      return json;
    },
    onSuccess: () => {
      if (organizationId) {
        void queryClient.invalidateQueries({ queryKey: whatsAppFlowsQueryKey(organizationId) });
      }
    },
  });
}
