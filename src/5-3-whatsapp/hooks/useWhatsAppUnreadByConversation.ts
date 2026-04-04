import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

const QUERY_KEY = ['whatsapp-unread-by-conversation'] as const;

export function useWhatsAppUnreadByConversation() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    const channelName = 'whatsapp_messages_unread_list';
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      )
      .subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [organizationId, queryClient]);

  const query = useQuery({
    queryKey: [...QUERY_KEY, organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Record<string, number>> => {
      if (!organizationId) return {};
      const { data, error } = await supabase.rpc('get_whatsapp_unread_counts', {
        p_organization_id: organizationId,
      });
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        const id = (row as { conversation_id: string; unread_count: number }).conversation_id;
        const count = Number((row as { conversation_id: string; unread_count: number }).unread_count) || 0;
        if (id && count > 0) map[id] = count;
      }
      return map;
    },
    refetchInterval: 15000,
  });

  const markConversationRead = async (conversationId: string) => {
    const { error } = await supabase.rpc('mark_whatsapp_conversation_read', {
      p_conversation_id: conversationId,
    });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    queryClient.invalidateQueries({ queryKey: ['whatsapp-unread-count'] });
  };

  const unreadByConversation: Record<string, number> = query.data ?? {};
  return {
    unreadByConversation,
    isLoading: query.isLoading,
    error: query.error,
    markConversationRead,
  };
}
