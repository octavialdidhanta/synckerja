import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { TikTokConversationsPage } from '../components/tiktok-inbox/tiktokConversation.types';

type ReadMessagesInput = {
  organizationId: string;
  accountId: string;
  conversationId: string;
};

type ReadMessagesResult = {
  ok: boolean;
  request_id?: string | null;
};

function clearUnreadInConversationsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  accountId: string,
  conversationId: string,
) {
  queryClient.setQueriesData<InfiniteData<TikTokConversationsPage>>(
    { queryKey: ['tiktok-shop-conversations', organizationId, accountId] },
    (old) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          conversations: page.conversations.map((c) =>
            c.id === conversationId ? { ...c, unread_count: 0 } : c,
          ),
        })),
      };
    },
  );
}

export function useTikTokShopReadMessages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReadMessagesInput): Promise<ReadMessagesResult> => {
      const { data, error } = await supabase.functions.invoke('tiktok-shop-customer-service', {
        body: {
          action: 'readMessages',
          organization_id: input.organizationId,
          account_id: input.accountId,
          conversation_id: input.conversationId,
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as ReadMessagesResult & { error?: string; code?: string };
      if (payload?.error) {
        throw await parseEdgeFunctionError(null, payload);
      }
      return {
        ok: payload.ok !== false,
        request_id: payload.request_id,
      };
    },
    onSuccess: (_data, variables) => {
      clearUnreadInConversationsCache(
        queryClient,
        variables.organizationId,
        variables.accountId,
        variables.conversationId,
      );
      void queryClient.invalidateQueries({
        queryKey: ['tiktok-shop-conversations', variables.organizationId, variables.accountId],
      });
    },
  });
}
