import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import type { WhatsAppMessage } from "../types";
import { FollowUpSendError } from "../utils/followUpSendError";

export interface SendWhatsAppFlowSessionParams {
  conversation_id: string;
  flow_id: string;
  navigate_screen?: string;
  flow_cta?: string;
  body_text?: string;
}

export function useSendWhatsAppFlowSession() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: SendWhatsAppFlowSessionParams) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const url = `${SUPABASE_URL}/functions/v1/send-whatsapp-flow-session`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(params),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const serverMsg = typeof json?.error === "string" ? json.error : "Failed to send flow";
        const code = typeof json?.code === "string" ? json.code : undefined;
        throw new FollowUpSendError(serverMsg, code);
      }
      return json as {
        success?: boolean;
        message?: WhatsAppMessage | null;
        conversation_id?: string;
        assignee_id?: string | null;
        assignee_auto_assigned?: boolean;
      };
    },
    onSuccess: (data, variables) => {
      const conversationId = data?.conversation_id ?? variables.conversation_id;
      if (conversationId && data?.message) {
        queryClient.setQueryData<WhatsAppMessage[]>(["whatsapp-messages", conversationId], (prev = []) => {
          if (prev.some((m) => m.id === data.message!.id)) return prev;
          return [...prev, data.message!].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );
        });
      } else if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", conversationId] });
      }
      if (conversationId) {
        const assigneeIdFromBackend = data?.assignee_id ?? null;
        if (assigneeIdFromBackend) {
          const statusQueryKey = ["whatsapp-conversation-status", conversationId] as const;
          queryClient.setQueryData(statusQueryKey, (prev: unknown) => {
            const base =
              prev && typeof prev === "object" && prev !== null && !Array.isArray(prev)
                ? (prev as Record<string, unknown>)
                : {};
            return {
              ...base,
              assignee_id: assigneeIdFromBackend,
            };
          });
        }
      }
    },
  });

  return {
    sendFlowSession: mutation.mutateAsync,
    isSendingFlowSession: mutation.isPending,
  };
}
