import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';

export const TIKTOK_SEND_MAX_LENGTH = 2000;

type SendMessageInput = {
  organizationId: string;
  accountId: string;
  conversationId: string;
  text: string;
};

type SendMessageResult = {
  message_id: string;
  request_id?: string | null;
};

export function useTikTokShopSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendMessageInput): Promise<SendMessageResult> => {
      const text = input.text.trim();
      if (!text) throw new Error('EMPTY');
      if (text.length > TIKTOK_SEND_MAX_LENGTH) throw new Error('TOO_LONG');

      const { data, error } = await supabase.functions.invoke('tiktok-shop-customer-service', {
        body: {
          action: 'sendMessage',
          organization_id: input.organizationId,
          account_id: input.accountId,
          conversation_id: input.conversationId,
          text,
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as SendMessageResult & { error?: string; code?: string };
      if (payload?.error) {
        throw await parseEdgeFunctionError(null, payload);
      }
      const messageId = String(payload.message_id ?? '').trim();
      if (!messageId) throw new Error('Missing message_id');
      return {
        message_id: messageId,
        request_id: payload.request_id,
      };
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          'tiktok-shop-conversation-messages',
          variables.organizationId,
          variables.accountId,
          variables.conversationId,
        ],
      });
      void queryClient.invalidateQueries({
        queryKey: ['tiktok-shop-conversations', variables.organizationId, variables.accountId],
      });
    },
  });
}
