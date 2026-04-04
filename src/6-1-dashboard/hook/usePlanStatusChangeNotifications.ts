import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuth } from '@/shared/auth/contexts/AuthContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface PlanStatusChangeNotificationRow {
  id: string;
  user_id: string;
  social_media_plan_id: string;
  organization_id: string;
  plan_title: string | null;
  change_kind: string | null;
  old_value: string | null;
  new_value: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

const QUERY_KEY = ['plan-status-change-notifications'] as const;

export function usePlanStatusChangeNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { organizationId } = useCurrentOrg();

  const userId = user?.id ?? null;

  const { data: notifications = [], isLoading, error, refetch } = useQuery({
    queryKey: [...QUERY_KEY, userId, organizationId],
    enabled: !!userId && !!organizationId,
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    queryFn: async (): Promise<PlanStatusChangeNotificationRow[]> => {
      if (!userId || !organizationId) return [];
      const { data, error: qErr } = await supabase
        .from('plan_status_change_notifications')
        .select('id, user_id, social_media_plan_id, organization_id, plan_title, change_kind, old_value, new_value, title, body, read_at, created_at')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (qErr) throw qErr;
      return (data ?? []) as PlanStatusChangeNotificationRow[];
    },
  });

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const { error: rpcErr } = await supabase.rpc('mark_plan_status_change_notifications_read', { notification_ids: null });
    if (rpcErr) throw rpcErr;
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [userId, queryClient]);

  const markOneRead = useCallback(async (notificationId: string) => {
    if (!userId) return;
    const { error: rpcErr } = await supabase.rpc('mark_plan_status_change_notifications_read', { notification_ids: [notificationId] });
    if (rpcErr) throw rpcErr;
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [userId, queryClient]);

  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channelName = `plan_status_change_notifications:${userId}`;
    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'plan_status_change_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'plan_status_change_notifications',
          filter: `user_id=eq.${userId}`,
        },
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
  }, [userId, organizationId, queryClient]);

  return {
    notifications,
    isLoading,
    error,
    markOneRead,
    markAllRead,
    refetch,
  };
}
