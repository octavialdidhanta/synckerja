import { useEffect, useRef } from 'react';
import {
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import type {
  TikTokConversation,
  TikTokConversationMessage,
  TikTokConversationsPage,
  TikTokMessagesPage,
} from '../components/tiktok-inbox/tiktokConversation.types';

export type TikTokShopCsMessageRow = {
  id?: string;
  organization_id: string;
  account_id: string;
  shop_id: string;
  conversation_id: string;
  message_id: string;
  message_type?: string | null;
  content?: string | null;
  sender_im_user_id?: string | null;
  sender_role?: string | null;
  is_visible?: boolean | null;
  message_index?: string | null;
  create_time?: number | null;
  tts_notification_id?: string | null;
};

function rowToMessage(row: TikTokShopCsMessageRow): TikTokConversationMessage {
  return {
    id: String(row.message_id),
    type: row.message_type != null ? String(row.message_type) : undefined,
    content: row.content != null ? String(row.content) : undefined,
    create_time: row.create_time != null ? Number(row.create_time) : undefined,
    is_visible: row.is_visible !== false,
    index: row.message_index != null ? String(row.message_index) : undefined,
    sender: {
      im_user_id: row.sender_im_user_id != null ? String(row.sender_im_user_id) : undefined,
      role: row.sender_role != null ? String(row.sender_role) : undefined,
    },
  };
}

function appendMessageToThreadCache(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  accountId: string,
  conversationId: string,
  message: TikTokConversationMessage,
) {
  queryClient.setQueriesData<InfiniteData<TikTokMessagesPage>>(
    {
      queryKey: [
        'tiktok-shop-conversation-messages',
        organizationId,
        accountId,
        conversationId,
      ],
    },
    (old) => {
      if (!old?.pages?.length) return old;
      const id = String(message.id ?? '').trim();
      if (!id) return old;

      for (const page of old.pages) {
        if (page.messages.some((m) => m.id === id)) return old;
      }

      // API pages are DESC (newest first); prepend so flattenMessagesAscending shows at bottom.
      const pages = old.pages.map((page, index) => {
        if (index !== 0) return page;
        return {
          ...page,
          messages: [message, ...page.messages],
        };
      });
      return { ...old, pages };
    },
  );
}

function patchConversationsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  accountId: string,
  conversationId: string,
  message: TikTokConversationMessage,
  options: { bumpUnread: boolean },
) {
  queryClient.setQueriesData<InfiniteData<TikTokConversationsPage>>(
    {
      queryKey: ['tiktok-shop-conversations', organizationId, accountId],
    },
    (old) => {
      if (!old?.pages?.length) return old;
      let found = false;
      const pages = old.pages.map((page) => ({
        ...page,
        conversations: page.conversations.map((c: TikTokConversation) => {
          if (c.id !== conversationId) return c;
          found = true;
          const unread = Number(c.unread_count ?? 0);
          return {
            ...c,
            latest_message: message,
            unread_count: options.bumpUnread ? unread + 1 : unread,
          };
        }),
      }));
      if (!found) return old;
      return { ...old, pages };
    },
  );
}

/**
 * Subscribe to TikTok Shop CS webhook-persisted rows and patch React Query caches.
 * - type 14 messages → append bubble / unread bump
 * - type 13 conversations → invalidate listConversations (pull API refresh)
 */
export function useTikTokShopCsRealtime(
  organizationId: string | null | undefined,
  accountId: string | null | undefined,
  openConversationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const openIdRef = useRef(openConversationId);
  openIdRef.current = openConversationId;

  useEffect(() => {
    if (!organizationId || !accountId || options?.enabled === false) return;

    const channelName = `tiktok_shop_cs:${accountId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tiktok_shop_cs_messages',
          filter: `account_id=eq.${accountId}`,
        },
        (payload) => {
          const row = payload.new as TikTokShopCsMessageRow | undefined;
          if (!row?.message_id || !row.conversation_id) return;
          if (row.organization_id && row.organization_id !== organizationId) return;
          if (row.is_visible === false) return;

          const message = rowToMessage(row);
          const conversationId = String(row.conversation_id);
          const isOpen = openIdRef.current === conversationId;
          const senderRole = String(row.sender_role ?? '').toUpperCase();
          const isBuyer = senderRole === 'BUYER';

          if (isOpen) {
            appendMessageToThreadCache(
              queryClient,
              organizationId,
              accountId,
              conversationId,
              message,
            );
          }

          patchConversationsCache(
            queryClient,
            organizationId,
            accountId,
            conversationId,
            message,
            { bumpUnread: isBuyer && !isOpen },
          );
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tiktok_shop_cs_conversations',
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['tiktok-shop-conversations', organizationId, accountId],
          });
        },
      );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, accountId, queryClient, options?.enabled]);
}
