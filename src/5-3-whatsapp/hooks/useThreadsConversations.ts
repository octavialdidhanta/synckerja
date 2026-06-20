import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { devLog } from '@/shared/lib/logger';
import { toast } from 'sonner';
import type { ThreadsConversation } from '../types';

const QUERY_KEY = ['threads-conversations'] as const;

type LivechatListResponse = {
  ok?: boolean;
  conversations?: ThreadsConversation[];
  sync?: {
    ingested?: number;
    scanned_posts?: number;
    scanned_replies?: number;
    accounts_synced?: number;
  };
  error?: string;
};

async function fetchThreadsLivechatConversations(
  organizationId: string,
): Promise<{ conversations: ThreadsConversation[]; sync: LivechatListResponse['sync'] }> {
  const { data, error } = await supabase.functions.invoke('threads-content-api', {
    body: {
      action: 'listLivechatConversations',
      organization_id: organizationId,
    },
  });
  if (error) {
    devLog.warn('Threads livechat list failed', error.message);
    throw error;
  }
  const payload = (data ?? {}) as LivechatListResponse;
  if (payload.error) {
    throw new Error(payload.error);
  }
  const sync = payload.sync;
  if (sync?.ingested && sync.ingested > 0) {
    devLog.info('Threads livechat ingested', sync.ingested);
  } else if (sync?.scanned_replies === 0 && sync?.scanned_posts === 0) {
    devLog.info('Threads livechat sync: no posts found for account');
  }
  return {
    conversations: Array.isArray(payload.conversations) ? payload.conversations : [],
    sync,
  };
}

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
      const { conversations } = await fetchThreadsLivechatConversations(organizationId);
      return conversations;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}
