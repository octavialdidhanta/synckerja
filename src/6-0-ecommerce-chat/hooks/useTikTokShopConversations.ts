import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { TikTokConversationsPage } from '../components/tiktok-inbox/tiktokConversation.types';

function localeForTikTokApi(language: string): string {
  return language.toLowerCase().startsWith('id') ? 'id-ID' : 'en';
}

async function invokeListConversations(params: {
  organizationId: string;
  accountId: string;
  pageToken?: string;
  locale: string;
}): Promise<TikTokConversationsPage> {
  const { data, error } = await supabase.functions.invoke('tiktok-shop-customer-service', {
    body: {
      action: 'listConversations',
      organization_id: params.organizationId,
      account_id: params.accountId,
      locale: params.locale,
      ...(params.pageToken ? { page_token: params.pageToken } : {}),
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as TikTokConversationsPage & { error?: string; code?: string };
  if (payload?.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return {
    next_page_token: String(payload.next_page_token ?? ''),
    conversations: Array.isArray(payload.conversations) ? payload.conversations : [],
    account: payload.account,
    request_id: payload.request_id,
  };
}

export function useTikTokShopConversations(
  organizationId: string | null | undefined,
  accountId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const { i18n } = useTranslation();
  const locale = localeForTikTokApi(i18n.language);
  const enabled =
    Boolean(organizationId) &&
    Boolean(accountId) &&
    options?.enabled !== false;

  return useInfiniteQuery({
    queryKey: ['tiktok-shop-conversations', organizationId, accountId, locale],
    queryFn: async ({ pageParam }) => {
      if (!organizationId || !accountId) {
        return { next_page_token: '', conversations: [] } satisfies TikTokConversationsPage;
      }
      return invokeListConversations({
        organizationId,
        accountId,
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
    staleTime: 30_000,
  });
}
