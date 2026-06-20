import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { devLog } from '@/shared/lib/logger';
import { toast } from 'sonner';
import type { ThreadsConversation } from '../types';

const QUERY_KEY = ['threads-conversations'] as const;

export function useThreadsConversations() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelErrorToastShownRef = useRef(false);

  useEffect(() => {
    if (!organizationId) return;
    const channelName = 'threads_conversations_list_realtime';
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    channelErrorToastShownRef.current = false;
    channelRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threads_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threads_conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'threads_conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          devLog.warn('Threads conversations realtime channel error', status);
          if (!channelErrorToastShownRef.current) {
            channelErrorToastShownRef.current = true;
            toast.warning('Koneksi realtime terganggu');
          }
        }
      });
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [organizationId, queryClient]);

  return useQuery({
    queryKey: [...QUERY_KEY, organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<ThreadsConversation[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase.rpc('get_threads_conversations_with_preview', {
        p_organization_id: organizationId,
      });
      if (error) throw error;
      return (data ?? []) as ThreadsConversation[];
    },
    refetchInterval: 20000,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
}
