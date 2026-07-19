import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type {
  TikTokMessagesPage,
} from '../components/tiktok-inbox/tiktokConversation.types';

function localeForTikTokApi(language: string): string {
  return language.toLowerCase().startsWith('id') ? 'id-ID' : 'en';
}

async function invokeListMessages(params: {
  organizationId: string;
  accountId: string;
  conversationId: string;
  pageToken?: string;
  locale: string;
}): Promise<TikTokMessagesPage> {
  const { data, error } = await supabase.functions.invoke('tiktok-shop-customer-service', {
    body: {
      action: 'listMessages',
      organization_id: params.organizationId,
      account_id: params.accountId,
      conversation_id: params.conversationId,
      locale: params.locale,
      ...(params.pageToken ? { page_token: params.pageToken } : {}),
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as TikTokMessagesPage & { error?: string; code?: string };
  if (payload?.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  const messages = (Array.isArray(payload.messages) ? payload.messages : [])
    .map((m) => ({
      ...m,
      id: String(m.id ?? '').trim(),
    }))
    .filter((m) => Boolean(m.id));

  return {
    next_page_token: String(payload.next_page_token ?? ''),
    unsupported_msg_tips: payload.unsupported_msg_tips,
    messages,
    account: payload.account,
    request_id: payload.request_id,
  };
}

export function useTikTokShopConversationMessages(
  organizationId: string | null | undefined,
  accountId: string | null | undefined,
  conversationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const { i18n } = useTranslation();
  const locale = localeForTikTokApi(i18n.language);
  const enabled =
    Boolean(organizationId) &&
    Boolean(accountId) &&
    Boolean(conversationId) &&
    options?.enabled !== false;

  return useInfiniteQuery({
    queryKey: [
      'tiktok-shop-conversation-messages',
      organizationId,
      accountId,
      conversationId,
      locale,
    ],
    queryFn: async ({ pageParam }) => {
      if (!organizationId || !accountId || !conversationId) {
        return {
          next_page_token: '',
          messages: [],
        } satisfies TikTokMessagesPage;
      }
      return invokeListMessages({
        organizationId,
        accountId,
        conversationId,
        pageToken: pageParam || undefined,
        locale,
      });
    },
    initialPageParam: '' as string,
    getNextPageParam: (last) => {
      const token = String(last.next_page_token ?? '').trim();
      return token || undefined;
    },
    enabled,
    staleTime: 20_000,
  });
}
