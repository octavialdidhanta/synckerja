import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuth } from '@/shared/auth/contexts/AuthContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface DailyTaskNotificationRow {
  id: string;
  user_id: string;
  organization_id: string;
  type: string;
  daily_task_id: string | null;
  task_step_id: string | null;
  task_steps_to_steps_id: string | null;
  completion_approval_id: string | null;
  title: string;
  body: string;
  view: string | null;
  read_at: string | null;
  created_at: string;
}

const QUERY_KEY = ['daily-task-notifications'] as const;

export function useDailyTaskNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { organizationId } = useCurrentOrg();

  const userId = user?.id ?? null;

  const { data: notifications = [], isLoading, error, refetch } = useQuery({
    queryKey: [...QUERY_KEY, userId, organizationId],
    enabled: !!userId && !!organizationId,
    queryFn: async (): Promise<DailyTaskNotificationRow[]> => {
      if (!userId || !organizationId) return [];
      const { data, error: qErr } = await supabase
        .from('daily_task_notifications')
        .select('id, user_id, organization_id, type, daily_task_id, task_step_id, task_steps_to_steps_id, completion_approval_id, title, body, view, read_at, created_at')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (qErr) throw qErr;
      return (data ?? []) as DailyTaskNotificationRow[];
    },
  });

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const { error: rpcErr } = await supabase.rpc('mark_daily_task_notifications_read', { notification_ids: null });
    if (rpcErr) throw rpcErr;
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [userId, queryClient]);

  const markOneRead = useCallback(async (notificationId: string) => {
    if (!userId) return;
    const { error: rpcErr } = await supabase.rpc('mark_daily_task_notifications_read', { notification_ids: [notificationId] });
    if (rpcErr) throw rpcErr;
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [userId, queryClient]);

  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channelName = `daily_task_notifications:${userId}`;
    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'daily_task_notifications',
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
          table: 'daily_task_notifications',
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

