import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';
import type { InstagramMessage } from '../types';

export interface SendInstagramMessageParams {
  to: string;
  text: string;
  conversation_id?: string | null;
  reply_to_wa_message_id?: string | null;
}

export function useSendInstagramMessage() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: SendInstagramMessageParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const url = `${SUPABASE_URL}/functions/v1/send-instagram-message`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: params.to,
          text: params.text,
          conversation_id: params.conversation_id ?? null,
          reply_to_wa_message_id: params.reply_to_wa_message_id ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (typeof json?.error === 'string' ? json.error : null) ??
          (typeof json?.details?.error?.message === 'string' ? json.details.error.message : null) ??
          (res.status === 400
            ? 'Permintaan tidak valid. Pastikan Instagram sudah terhubung dan token masih berlaku di Connect Instagram.'
            : res.status === 502
              ? 'Gagal kirim. Cek: 1) Token di Connect Instagram (coba Connect with Facebook only lagi). 2) Pengguna harus mengirim pesan dalam 24 jam terakhir. 3) Log di Supabase → Edge Functions → send-instagram-message.'
              : 'Gagal mengirim pesan.');
        throw new Error(msg);
      }
      return json;
    },
    onSuccess: (data: { success?: boolean; message?: InstagramMessage | null; lead_status_id?: string | null }, variables) => {
      const conversationId = variables.conversation_id;
      if (conversationId && data?.message) {
        queryClient.setQueryData<InstagramMessage[]>(
          ['instagram-messages', conversationId],
          (prev = []) => {
            if (prev.some((m) => m.id === data.message!.id)) return prev;
            return [...prev, data.message!].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          }
        );
      }
      if (conversationId) {
        if (!data?.message) {
          queryClient.invalidateQueries({ queryKey: ['instagram-messages', conversationId] });
        }
        const statusQueryKey = ['instagram-conversation-status', conversationId] as const;
        const statusIdFromBackend = data?.lead_status_id ?? null;
        if (statusIdFromBackend) {
          queryClient.setQueryData(statusQueryKey, statusIdFromBackend);
        } else {
          const leadStatuses = queryClient.getQueryData<Array<{ id: string; name: string }>>(['lead-statuses']);
          const inProgressStatus = leadStatuses?.find((s) => (s.name ?? '').trim().toLowerCase() === 'in progress');
          if (inProgressStatus?.id) {
            queryClient.setQueryData(statusQueryKey, inProgressStatus.id);
          }
        }
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['instagram-conversations'] });
          void queryClient.refetchQueries({ queryKey: statusQueryKey });
        }, 1500);
      }
    },
  });

  return {
    send: mutation.mutateAsync,
    isSending: mutation.isPending,
  };
}
