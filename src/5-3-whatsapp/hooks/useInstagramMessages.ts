import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import type { InstagramMessage } from '../types';

const QUERY_KEY = ['instagram-messages'] as const;

export function useInstagramMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const channelName = `instagram_messages:${conversationId}`;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instagram_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new?: { direction?: string } }) => {
          queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, conversationId] });
          queryClient.invalidateQueries({ queryKey: ['instagram-conversations'] });
          // Refresh status UI when message is INBOUND (customer sent). Same logic as useWhatsAppMessages.
          const isInbound = payload?.new?.direction === 'inbound';
          if (isInbound) {
            queryClient.invalidateQueries({ queryKey: ['instagram-conversation-status', conversationId] });
            if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = setTimeout(() => {
              fallbackTimeoutRef.current = null;
              queryClient.invalidateQueries({ queryKey: ['instagram-conversation-status', conversationId] });
              queryClient.invalidateQueries({ queryKey: ['instagram-conversations'] });
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, queryClient]);

  return useQuery({
    queryKey: [...QUERY_KEY, conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<InstagramMessage[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('instagram_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as InstagramMessage[];
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });
}
