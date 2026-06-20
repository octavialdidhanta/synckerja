import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { findInProgressLeadStatusId } from '../constants/leadStatus';
import type { ThreadsMessage } from '../types';

export interface SendThreadsMessageParams {
  text: string;
  conversation_id: string;
  reply_to_platform_message_id?: string | null;
}

export function useSendThreadsMessage() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: SendThreadsMessageParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-threads-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversation_id: params.conversation_id,
          text: params.text,
          reply_to_platform_message_id: params.reply_to_platform_message_id ?? null,
        }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string; code?: string };
      if (!res.ok) {
        if (json?.code === 'NOT_ASSIGNEE' && typeof json.error === 'string') {
          throw new Error(json.error);
        }
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to send Threads reply.');
      }
      return json;
    },
    onSuccess: (data: { message?: ThreadsMessage | null; lead_status_id?: string | null }, variables) => {
      const conversationId = variables.conversation_id;
      if (conversationId && data?.message) {
        queryClient.setQueryData<ThreadsMessage[]>(
          ['threads-messages', conversationId],
          (prev = []) => {
            if (prev.some((m) => m.id === data.message!.id)) return prev;
            return [...prev, data.message!].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            );
          },
        );
      } else if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['threads-messages', conversationId] });
      }
      if (conversationId) {
        const statusQueryKey = ['threads-conversation-status', conversationId] as const;
        const nextStatusId = data?.lead_status_id ?? findInProgressLeadStatusId(
          queryClient.getQueryData<Array<{ id: string; name: string }>>(['lead-statuses']) ?? [],
        ) ?? null;
        if (nextStatusId) {
          queryClient.setQueryData(statusQueryKey, (prev: unknown) => {
            const base = prev && typeof prev === 'object' && prev !== null && 'lead_status_id' in (prev as object)
              ? (prev as { lead_status_id?: string | null })
              : {};
            return { ...base, lead_status_id: nextStatusId };
          });
        }
        void queryClient.invalidateQueries({ queryKey: statusQueryKey });
        void queryClient.invalidateQueries({ queryKey: ['threads-conversations'] });
      }
    },
  });

  return {
    send: mutation.mutateAsync,
    isSending: mutation.isPending,
  };
}
