import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { findInProgressLeadStatusId } from '../constants/leadStatus';
import type { InstagramMessage } from '../types';

export interface SendInstagramMessageParams {
  to: string;
  text: string;
  conversation_id?: string | null;
  reply_to_wa_message_id?: string | null;
  media_type?: 'image' | 'video';
  media_link?: string;
  caption?: string;
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
          media_type: params.media_type ?? null,
          media_link: params.media_link ?? null,
          caption: params.caption ?? null,
        }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string; code?: string; details?: { error?: { message?: string } } };
      if (!res.ok) {
        if (json?.code === 'NOT_ASSIGNEE' && typeof json.error === 'string') {
          throw new Error(json.error);
        }
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
        const orgStatuses =
          queryClient.getQueriesData<Array<{ id: string; name: string }>>({
            queryKey: ['lead-statuses'],
          }) ?? [];
        const mergedStatuses = orgStatuses.flatMap(([, rows]) => rows ?? []);
        const globalStatuses =
          queryClient.getQueryData<Array<{ id: string; name: string }>>(['lead-statuses']) ?? [];
        const leadStatuses = mergedStatuses.length > 0 ? mergedStatuses : globalStatuses;
        const nextStatusId = statusIdFromBackend ?? findInProgressLeadStatusId(leadStatuses) ?? null;
        if (nextStatusId) {
          queryClient.setQueryData(statusQueryKey, (prev: unknown) => {
            const base =
              prev &&
              typeof prev === 'object' &&
              prev !== null &&
              !Array.isArray(prev) &&
              'lead_status_id' in (prev as Record<string, unknown>)
                ? (prev as {
                    lead_status_id?: string | null;
                    last_inbound_at?: string | null;
                    created_at?: string | null;
                    assignee_id?: string | null;
                  })
                : {};
            return { ...base, lead_status_id: nextStatusId };
          });
        }
        void queryClient.invalidateQueries({ queryKey: statusQueryKey });
        void queryClient.invalidateQueries({ queryKey: ['instagram-conversations'] });
      }
    },
  });

  return {
    send: mutation.mutateAsync,
    isSending: mutation.isPending,
  };
}
