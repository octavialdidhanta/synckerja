import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { devLog } from '@/shared/lib/logger';
import { toast } from 'sonner';
import type { ThreadsConversation } from '../types';

const QUERY_KEY = ['threads-conversations'] as const;
const SYNC_MIN_MS = 30_000;

type SyncLivechatResult = {
  ok?: boolean;
  ingested?: number;
  scanned_posts?: number;
  scanned_replies?: number;
};

async function syncThreadsLivechatInbound(organizationId: string): Promise<SyncLivechatResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('threads-content-api', {
      body: {
        action: 'syncLivechatInbound',
        organization_id: organizationId,
        lookback_days: 60,
        max_posts: 40,
      },
    });
    if (error) {
      devLog.warn('Threads livechat sync failed', error.message);
      return null;
    }
    const result = (data ?? null) as SyncLivechatResult | null;
    if (result?.ingested && result.ingested > 0) {
      devLog.info('Threads livechat sync ingested', result.ingested);
    }
    return result;
  } catch (e) {
    devLog.warn('Threads livechat sync error', e);
    return null;
  }
}

export function useThreadsConversations() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelErrorToastShownRef = useRef(false);
  const lastSyncAtRef = useRef<Map<string, number>>(new Map());

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

      const lastSync = lastSyncAtRef.current.get(organizationId) ?? 0;
      if (Date.now() - lastSync >= SYNC_MIN_MS) {
        lastSyncAtRef.current.set(organizationId, Date.now());
        await syncThreadsLivechatInbound(organizationId);
      }

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
