import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import type { FacebookMessage } from '../types';

const QUERY_KEY = ['facebook-messages'] as const;

export function useFacebookMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const channelName = `facebook_messages:${conversationId}`;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(channelName);

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'facebook_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: { new?: { direction?: string } }) => {
        queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, conversationId] });
        queryClient.invalidateQueries({ queryKey: ['facebook-conversations'] });
        const direction = payload?.new?.direction;
        if (direction === 'inbound' || direction === 'outbound') {
          queryClient.invalidateQueries({ queryKey: ['facebook-conversation-status', conversationId] });
        }
        if (direction === 'inbound') {
          if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
          fallbackTimeoutRef.current = setTimeout(() => {
            fallbackTimeoutRef.current = null;
            queryClient.invalidateQueries({ queryKey: ['facebook-conversation-status', conversationId] });
            queryClient.invalidateQueries({ queryKey: ['facebook-conversations'] });
          }, 2000);
        }
      },
    );

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'facebook_conversations',
        filter: `id=eq.${conversationId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ['facebook-conversation-status', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['facebook-conversations'] });
      },
    );

    channelRef.current = channel;
    channel.subscribe();

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
    queryFn: async (): Promise<FacebookMessage[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('facebook_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FacebookMessage[];
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });
}
