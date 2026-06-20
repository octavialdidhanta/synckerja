import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { devLog } from '@/shared/lib/logger';
import { toast } from 'sonner';
import type { ThreadsConversation } from '../types';

const QUERY_KEY = ['threads-conversations'] as const;
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const SYNC_SESSION_KEY = 'threads-livechat-last-sync-at';

let syncInFlight = false;

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

function canRunBackgroundSync(): boolean {
  try {
    const raw = sessionStorage.getItem(SYNC_SESSION_KEY);
    const last = raw ? Number(raw) : 0;
    return !Number.isFinite(last) || Date.now() - last >= SYNC_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markBackgroundSyncRan(): void {
  try {
    sessionStorage.setItem(SYNC_SESSION_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function triggerThreadsLivechatSync(
  organizationId: string,
  onIngested?: () => void,
): void {
  if (syncInFlight || !canRunBackgroundSync()) return;
  syncInFlight = true;

  void supabase.functions
    .invoke('threads-content-api', {
      body: {
        action: 'syncLivechatInbound',
        organization_id: organizationId,
        lookback_days: 7,
        max_posts: 8,
      },
    })
    .then(({ data, error }) => {
      if (error) {
        devLog.warn('Threads livechat background sync failed', error.message);
        return;
      }
      markBackgroundSyncRan();
      const payload = (data ?? {}) as { ingested?: number; scanned_replies?: number };
      if (payload.ingested && payload.ingested > 0) {
        devLog.info('Threads livechat ingested', payload.ingested);
        onIngested?.();
      }
    })
    .catch((err: unknown) => {
      devLog.warn('Threads livechat background sync error', err);
    })
    .finally(() => {
      syncInFlight = false;
    });
}

export function useThreadsConversations() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelErrorToastShownRef = useRef(false);
  const syncStartedRef = useRef(false);

  useEffect(() => {
    if (!organizationId || syncStartedRef.current) return;
    syncStartedRef.current = true;

    triggerThreadsLivechatSync(organizationId, () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    });
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
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
