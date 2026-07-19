import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';

type CreateConversationInput = {
  organizationId: string;
  accountId: string;
  orderId: string;
};

type CreateConversationResult = {
  conversation_id: string;
  buyer_user_id: string;
  order_id: string;
  request_id?: string | null;
  account?: {
    id: string;
    shop_id: string;
    shop_name: string | null;
  };
};

export function useTikTokShopCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateConversationInput): Promise<CreateConversationResult> => {
      const orderId = input.orderId.trim();
      if (!orderId) throw new Error('MISSING_ORDER_ID');

      const { data, error } = await supabase.functions.invoke('tiktok-shop-customer-service', {
        body: {
          action: 'createConversation',
          organization_id: input.organizationId,
          account_id: input.accountId,
          order_id: orderId,
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as CreateConversationResult & { error?: string; code?: string };
      if (payload?.error) {
        throw await parseEdgeFunctionError(null, payload);
      }
      const conversationId = String(payload.conversation_id ?? '').trim();
      if (!conversationId) throw new Error('Missing conversation_id');
      return {
        conversation_id: conversationId,
        buyer_user_id: String(payload.buyer_user_id ?? '').trim(),
        order_id: String(payload.order_id ?? orderId).trim(),
        request_id: payload.request_id,
        account: payload.account,
      };
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['tiktok-shop-conversations', variables.organizationId, variables.accountId],
      });
    },
  });
}
