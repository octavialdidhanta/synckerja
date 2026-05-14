import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';
import type { WhatsAppMessage } from '../types';

export interface SendWhatsAppMessageParams {
  to: string;
  /** Required for text; optional when sending media (caption can be used instead). */
  text?: string;
  conversation_id?: string | null;
  media_type?: 'image' | 'video' | 'document';
  media_link?: string;
  caption?: string;
  /** WhatsApp message ID yang dibalas (context.reply_to). */
  reply_to_wa_message_id?: string | null;
  /** Body pesan yang dibalas (ditampilkan di bubble agar jelas). */
  reply_to_body?: string | null;
  /** Tipe pesan yang dibalas (text, image, video, document, audio). */
  reply_to_message_type?: string | null;
  /** Nama pengirim pesan yang dibalas (untuk tampilan reply seperti WhatsApp). */
  reply_to_sender?: string | null;
}

export function useSendWhatsAppMessage() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: SendWhatsAppMessageParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const url = `${SUPABASE_URL}/functions/v1/send-whatsapp-message`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: params.to,
          text: params.text ?? '',
          conversation_id: params.conversation_id ?? null,
          media_type: params.media_type ?? null,
          media_link: params.media_link ?? null,
          caption: params.caption ?? null,
          reply_to_wa_message_id: params.reply_to_wa_message_id ?? null,
          reply_to_body: params.reply_to_body ?? null,
          reply_to_message_type: params.reply_to_message_type ?? null,
          reply_to_sender: params.reply_to_sender ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const serverMsg = typeof json?.error === 'string' ? json.error : null;
        const metaMsg = json?.details?.error?.message ?? json?.details?.error_message;
        const rawMsg = serverMsg || metaMsg || (typeof json?.error === 'string' ? json.error : null) || 'Failed to send';
        const msg = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg);
        const isPermissionError = json?.code === 10 || msg.includes('(#10)');
        const friendlyMsg = isPermissionError
          ? 'WhatsApp: Aplikasi tidak memiliki izin untuk mengirim pesan. Periksa konfigurasi WhatsApp Business dan izin di Meta Developer.'
          : msg;
        throw new Error(friendlyMsg);
      }
      return json;
    },
    onSuccess: (data: { success?: boolean; message?: WhatsAppMessage | null; lead_status_id?: string | null }, variables) => {
      const conversationId = variables.conversation_id;
      if (conversationId && data?.message) {
        queryClient.setQueryData<WhatsAppMessage[]>(
          ['whatsapp-messages', conversationId],
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
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', conversationId] });
        }
        const statusQueryKey = ['whatsapp-conversation-status', conversationId] as const;
        // Prefer lead_status_id from backend. Merge into existing row shape — never replace cache with a bare
        // UUID string (that drops assignee_id / timestamps until refetch; Quick Action then shows "Belum ditetapkan").
        const statusIdFromBackend = data?.lead_status_id ?? null;
        const leadStatuses = queryClient.getQueryData<Array<{ id: string; name: string }>>(['lead-statuses']);
        const inProgressStatus = leadStatuses?.find((s) => (s.name ?? '').trim().toLowerCase() === 'in progress');
        const nextStatusId = statusIdFromBackend ?? inProgressStatus?.id ?? null;
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
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
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
