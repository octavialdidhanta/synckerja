import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import type { ThreadsMessage } from '../types';

const QUERY_KEY = ['threads-messages'] as const;

export function useThreadsMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const channelName = `threads_messages:${conversationId}`;
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
        table: 'threads_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, conversationId] });
        queryClient.invalidateQueries({ queryKey: ['threads-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['threads-conversation-status', conversationId] });
      },
    );
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'threads_conversations',
        filter: `id=eq.${conversationId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ['threads-conversation-status', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['threads-conversations'] });
      },
    );

    channelRef.current = channel;
    channel.subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, queryClient]);

  return useQuery({
    queryKey: [...QUERY_KEY, conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<ThreadsMessage[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('threads_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ThreadsMessage[];
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });
}
