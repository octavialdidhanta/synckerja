import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuth } from '@/shared/auth/contexts/AuthContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; status?: number; details?: string; hint?: string };
  return (
    e.code === 'PGRST205' ||
    e.status === 404 ||
    e.message?.includes('Could not find the table') === true ||
    e.details?.includes('schema cache') === true
  );
}

export type SocialMediaProductionEventType =
  | 'approved'
  | 'revision_requested'
  | 'revision_submitted';

export interface SocialMediaProductionNotificationRow {
  id: string;
  user_id: string;
  organization_id: string;
  social_media_plan_id: string;
  review_token: string | null;
  event_type: SocialMediaProductionEventType;
  title: string;
  body: string;
  url: string;
  read_at: string | null;
  created_at: string;
}

const QUERY_KEY = ['social-media-production-notifications'] as const;

export function useSocialMediaProductionNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { organizationId } = useCurrentOrg();

  const userId = user?.id ?? null;

  const { data: notifications = [], refetch } = useQuery({
    queryKey: [...QUERY_KEY, userId, organizationId],
    enabled: !!userId && !!organizationId,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (isMissingTableError(error)) return false;
      return failureCount < 1;
    },
    queryFn: async (): Promise<SocialMediaProductionNotificationRow[]> => {
      if (!userId || !organizationId) return [];
      const { data, error } = await supabase
        .from('social_media_production_notifications')
        .select(
          'id, user_id, organization_id, social_media_plan_id, review_token, event_type, title, body, url, read_at, created_at',
        )
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        if (isMissingTableError(error)) return [];
        throw error;
      }
      return (data ?? []) as SocialMediaProductionNotificationRow[];
    },
  });

  const unreadCountQuery = useQuery({
    queryKey: [...QUERY_KEY, 'unread', userId, organizationId],
    enabled: !!userId && !!organizationId,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (isMissingTableError(error)) return false;
      return failureCount < 1;
    },
    queryFn: async (): Promise<number> => {
      if (!userId || !organizationId) return 0;
      const { count, error } = await supabase
        .from('social_media_production_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .is('read_at', null);
      if (error) {
        if (isMissingTableError(error)) return 0;
        throw error;
      }
      return count ?? 0;
    },
  });

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const { error } = await supabase.rpc('mark_social_media_production_notifications_read', {
      notification_ids: null,
    });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, userId] });
    queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'unread', userId] });
  }, [userId, queryClient]);

  const markOneRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;
      const { error } = await supabase.rpc('mark_social_media_production_notifications_read', {
        notification_ids: [notificationId],
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, userId] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'unread', userId] });
    },
    [userId, queryClient],
  );

  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channelName = `social_media_production_notifications:${userId}`;
    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'social_media_production_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, userId, organizationId ?? ''] });
          queryClient.invalidateQueries({
            queryKey: [...QUERY_KEY, 'unread', userId, organizationId ?? ''],
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'social_media_production_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, userId, organizationId ?? ''] });
          queryClient.invalidateQueries({
            queryKey: [...QUERY_KEY, 'unread', userId, organizationId ?? ''],
          });
        },
      )
      .subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, organizationId, queryClient]);

  const count = unreadCountQuery.data ?? 0;

  return {
    notifications,
    unreadCount: count,
    isLoading: unreadCountQuery.isLoading,
    markAllRead,
    markOneRead,
    refetch,
  };
}
