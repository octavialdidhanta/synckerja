import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import { OPERATIONS_CUSTOMERS_FEEDBACK_QUERY_KEY } from './usePosReceiptFeedback';

export function useReplyPosReceiptFeedback() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { feedbackId: string; replyText: string }) => {
      const { data, error } = await supabase.rpc('reply_pos_receipt_feedback', {
        p_feedback_id: input.feedbackId,
        p_reply_text: input.replyText,
      });
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, unknown>;
      if (payload.ok !== true) throw new Error(String(payload.error ?? 'reply_failed'));
      return {
        replyText: String(payload.reply_text ?? input.replyText),
        repliedAt: payload.replied_at != null ? String(payload.replied_at) : null,
      };
    },
    onSuccess: () => {
      if (!organizationId) return;
      void queryClient.invalidateQueries({
        queryKey: [OPERATIONS_CUSTOMERS_FEEDBACK_QUERY_KEY, organizationId],
      });
    },
  });
}
