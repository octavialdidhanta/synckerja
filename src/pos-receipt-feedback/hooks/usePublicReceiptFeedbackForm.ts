import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { parsePublicReceiptFeedbackPayload } from './parsePublicReceiptFeedback';

export function usePublicReceiptFeedbackForm(token: string | undefined) {
  const trimmed = (token ?? '').trim();

  const formQuery = useQuery({
    queryKey: ['public-pos-receipt-feedback', trimmed],
    enabled: trimmed.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_pos_receipt_feedback', {
        p_token: trimmed,
      });
      if (error) throw error;
      const parsed = parsePublicReceiptFeedbackPayload(data);
      if (parsed.ok === false) throw new Error(parsed.error);
      return parsed.data;
    },
    retry: 0,
  });

  const submitMutation = useMutation({
    mutationFn: async (input: { rating: number; comment: string }) => {
      const { data, error } = await supabase.rpc('submit_public_pos_receipt_feedback', {
        p_token: trimmed,
        p_rating: input.rating,
        p_comment: input.comment,
      });
      if (error) throw error;
      if (!data || typeof data !== 'object') return { thankYouMessage: '' };
      const o = data as Record<string, unknown>;
      if (o.ok !== true) throw new Error(String(o.error ?? 'submit_failed'));
      return { thankYouMessage: String(o.thank_you_message ?? '') };
    },
  });

  return { token: trimmed, formQuery, submitMutation };
}
