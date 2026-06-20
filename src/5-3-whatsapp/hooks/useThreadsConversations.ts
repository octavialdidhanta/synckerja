import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { devLog } from '@/shared/lib/logger';
import { toast } from 'sonner';
import type { ThreadsConversation } from '../types';

const QUERY_KEY = ['threads-conversations'] as const;
const SYNC_INTERVAL_MS = 3 * 60 * 1000;

async function fetchThreadsConversations(organizationId: string): Promise<ThreadsConversation[]> {
  const { data, error } = await supabase.rpc('get_threads_conversations_with_preview', {
    p_organization_id: organizationId,
  });
  if (error) {
    devLog.warn('Threads conversations RPC failed', error.message);
    throw error;
  }
  return (data ?? []) as ThreadsConversation[];
}

function triggerThreadsLivechatSync(
  organizationId: string,
  onIngested?: () => void,
): void {
  void supabase.functions
    .invoke('threads-content-api', {
      body: {
        action: 'syncLivechatInbound',
        organization_id: organizationId,
        lookback_days: 14,
        max_posts: 15,
      },
    })
    .then(({ data, error }) => {
      if (error) {
        devLog.warn('Threads livechat background sync failed', error.message);
        return;
      }
      const payload = (data ?? {}) as { ingested?: number; scanned_replies?: number };
      if (payload.ingested && payload.ingested > 0) {
        devLog.info('Threads livechat ingested', payload.ingested);
        onIngested?.();
      } else if (payload.scanned_replies === 0) {
        devLog.info('Threads livechat sync: no new replies');
      }
    })
    .catch((err: unknown) => {
      devLog.warn('Threads livechat background sync error', err);
    });
}

export function useThreadsConversations() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelErrorToastShownRef = useRef(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    };

    triggerThreadsLivechatSync(organizationId, invalidate);
    syncIntervalRef.current = setInterval(() => {
      triggerThreadsLivechatSync(organizationId, invalidate);
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [organizationId, queryClient]);

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
      return fetchThreadsConversations(organizationId);
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}
