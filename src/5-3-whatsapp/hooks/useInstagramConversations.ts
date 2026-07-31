import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { devLog } from '@/shared/lib/logger';
import { toast } from 'sonner';
import { dedupeInstagramConversations } from '../lib/dedupeInstagramConversations';
import type { InstagramConversation } from '../types';

const QUERY_KEY = ['instagram-conversations'] as const;

export function useInstagramConversations() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelErrorToastShownRef = useRef(false);

  useEffect(() => {
    if (!organizationId) return;
    const channelName = 'instagram_conversations_list_realtime';
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    channelErrorToastShownRef.current = false;
    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'instagram_messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'instagram_conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'instagram_conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          devLog.warn('Instagram conversations realtime channel error', status);
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
    queryFn: async (): Promise<InstagramConversation[]> => {
      if (!organizationId) return [];
      const [{ data, error }, { data: accounts, error: accountsError }] = await Promise.all([
        supabase.rpc('get_instagram_conversations_with_preview', {
          p_organization_id: organizationId,
        }),
        supabase
          .from('organization_instagram_accounts')
          .select('instagram_business_account_id')
          .eq('organization_id', organizationId)
          .eq('is_active', true),
      ]);
      if (error) throw error;
      if (accountsError) throw accountsError;

      // Hide threads from disconnected IG inboxes (no token → no photo, looks like "ghost" duplicates).
      const activeInboxIds = new Set(
        (accounts ?? [])
          .map((a) => (a.instagram_business_account_id ?? '').trim())
          .filter(Boolean),
      );
      const connectedOnly = ((data ?? []) as InstagramConversation[]).filter((conv) => {
        const inboxId = (conv.instagram_business_account_id ?? '').trim();
        return inboxId !== '' && activeInboxIds.has(inboxId);
      });

      return dedupeInstagramConversations(connectedOnly);
    },
    refetchInterval: 20000,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
}
