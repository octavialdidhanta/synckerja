import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';
import type { EmailMessage } from '../types';

export interface SendEmailReplyParams {
  conversation_id: string;
  body: string;
  subject?: string | null;
  /** Override To (default: conversation from_email). */
  to?: string | null;
  cc?: string | null;
  bcc?: string | null;
  /** Base64-encoded attachments (same format as Resend API). */
  attachments?: Array<{ filename: string; content: string }>;
}

export function useSendEmailReply() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: SendEmailReplyParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const url = `${SUPABASE_URL}/functions/v1/send-email-reply`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversation_id: params.conversation_id,
          body: params.body,
          subject: params.subject ?? undefined,
          to: params.to ?? undefined,
          cc: params.cc ?? undefined,
          bcc: params.bcc ?? undefined,
          attachments: params.attachments?.length ? params.attachments : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof json?.error === 'string' ? json.error : 'Failed to send reply';
        throw new Error(msg);
      }
      return json as { success: boolean; message: EmailMessage };
    },
    onSuccess: (data, variables) => {
      const conversationId = variables.conversation_id;
      if (conversationId && data?.message) {
        queryClient.setQueryData<EmailMessage[]>(
          ['email-messages', conversationId],
          (prev = []) => {
            if (prev.some((m) => m.id === data.message!.id)) return prev;
            return [...prev, data.message!].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: ['email-messages', variables.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['email-conversations'] });
      const statusQueryKey = ['email-conversation-status', conversationId] as const;
      const leadStatuses = queryClient.getQueryData<Array<{ id: string; name: string }>>(['lead-statuses']);
      const inProgressStatus = leadStatuses?.find((s) => (s.name ?? '').trim().toLowerCase() === 'in progress');
      if (inProgressStatus?.id) {
        queryClient.setQueryData(statusQueryKey, inProgressStatus.id);
      }
      // Jangan invalidate/refetch status di sini: refetch 800ms bisa dapat data lama (race dengan backend)
      // dan status balik ke Unread. Optimistic update di atas cukup; refetchInterval 5s di panel akan sync nanti.
    },
  });

  return {
    sendReply: mutation.mutateAsync,
    isSending: mutation.isPending,
    error: mutation.error,
  };
}
