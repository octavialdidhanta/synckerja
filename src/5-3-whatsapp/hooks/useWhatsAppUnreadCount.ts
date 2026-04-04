import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

const QUERY_KEY = ['whatsapp-unread-count'] as const;

export function useWhatsAppUnreadCount() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    const channelName = 'whatsapp_messages_unread_badge';
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

  return useQuery({
    queryKey: [...QUERY_KEY, organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<number> => {
      if (!organizationId) return 0;
      const { data, error } = await supabase.rpc('get_whatsapp_unread_counts', {
        p_organization_id: organizationId,
      });
      if (error) throw error;
      const total = (data ?? []).reduce(
        (sum: number, row: { unread_count: number }) => sum + (Number(row.unread_count) || 0),
        0
      );
      return total;
    },
    refetchInterval: 30000,
  });
}
