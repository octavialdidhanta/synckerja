import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';
import type { WhatsAppMessage } from '../types';

export interface SendWhatsAppTemplateFollowupParams {
  conversation_id?: string;
  lead_id?: string;
  template_name: string;
  template_language: string;
  template_hsm_id: string | null;
  template_components_json: unknown[];
  parameter_values: string[];
}

export function useSendWhatsAppTemplateFollowup() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: SendWhatsAppTemplateFollowupParams) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const url = `${SUPABASE_URL}/functions/v1/send-whatsapp-template-followup`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const serverMsg = typeof json?.error === 'string' ? json.error : 'Failed to send follow-up';
        throw new Error(serverMsg);
      }
      return json as {
        success?: boolean;
        message?: WhatsAppMessage | null;
        followup_id?: string | null;
        lead_status_id?: string | null;
        conversation_id?: string;
        conversation_created?: boolean;
        lead_id?: string;
      };
    },
    onSuccess: (data, variables) => {
      const conversationId = data?.conversation_id ?? variables.conversation_id;
      if (conversationId && data?.message) {
        queryClient.setQueryData<WhatsAppMessage[]>(['whatsapp-messages', conversationId], (prev = []) => {
          if (prev.some((m) => m.id === data.message!.id)) return prev;
          return [...prev, data.message!].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );
        });
      } else if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', conversationId] });
      }
      if (conversationId) {
        const statusQueryKey = ['whatsapp-conversation-status', conversationId] as const;
        const statusIdFromBackend = data?.lead_status_id ?? null;
        if (statusIdFromBackend) {
          queryClient.setQueryData(statusQueryKey, (prev: unknown) => {
            const base =
              prev && typeof prev === 'object' && prev !== null && !Array.isArray(prev)
                ? (prev as Record<string, unknown>)
                : {};
            return { ...base, lead_status_id: statusIdFromBackend };
          });
        }
        queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation-status', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['whatsapp-template-followups'] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      } else if (variables.lead_id || data?.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
        if (conversationId) {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', conversationId] });
        }
      }
    },
  });

  return {
    sendFollowUp: mutation.mutateAsync,
    isSendingFollowUp: mutation.isPending,
  };
}
