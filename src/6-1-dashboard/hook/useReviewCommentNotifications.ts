import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuth } from '@/shared/auth/contexts/AuthContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; status?: number; details?: string; hint?: string };
  return (
    e.code === 'PGRST205' || // "Could not find the table ... in the schema cache"
    e.status === 404 ||
    e.message?.includes('Could not find the table') === true ||
    e.details?.includes('schema cache') === true
  );
}

export interface ReviewCommentNotificationRow {
  id: string;
  user_id: string;
  link_comment_id: string;
  social_media_plan_id: string;
  review_token: string;
  plan_title: string | null;
  commenter_display_name: string | null;
  read_at: string | null;
  created_at: string;
  /** Comment message text (from link_comments join) */
  comment_text: string | null;
}

const QUERY_KEY = ['review-comment-notifications'] as const;

export function useReviewCommentNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { organizationId } = useCurrentOrg();

  const userId = user?.id ?? null;

  const { data: notifications = [], refetch } = useQuery({
    queryKey: [...QUERY_KEY, userId, organizationId],
    enabled: !!userId && !!organizationId,
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    retry: (failureCount, error) => {
      if (isMissingTableError(error)) return false;
      return failureCount < 1;
    },
    queryFn: async (): Promise<ReviewCommentNotificationRow[]> => {
      if (!userId || !organizationId) return [];
      const { data, error } = await supabase
        .from('review_comment_notifications')
        .select('id, user_id, link_comment_id, social_media_plan_id, review_token, plan_title, commenter_display_name, read_at, created_at, link_comments(comment_text), social_media_plans!inner(organization_id)')
        .eq('user_id', userId)
        .eq('social_media_plans.organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        if (isMissingTableError(error)) return [];
        throw error;
      }
      const rows = (data ?? []) as unknown as Array<Record<string, unknown> & { link_comments?: { comment_text: string | null } | Array<{ comment_text: string | null }> | null }>;
      return rows.map((row) => {
        const lc = row.link_comments;
        const commentText = Array.isArray(lc) ? lc[0]?.comment_text ?? null : (lc as { comment_text: string | null } | undefined)?.comment_text ?? null;
        return {
          id: row.id,
          user_id: row.user_id,
          link_comment_id: row.link_comment_id,
          social_media_plan_id: row.social_media_plan_id,
          review_token: row.review_token,
          plan_title: row.plan_title ?? null,
          commenter_display_name: row.commenter_display_name ?? null,
          read_at: row.read_at ?? null,
          created_at: row.created_at,
          comment_text: commentText,
        };
      }) as ReviewCommentNotificationRow[];
    },
  });

  const unreadCountQuery = useQuery({
    queryKey: [...QUERY_KEY, 'unread', userId, organizationId],
    enabled: !!userId && !!organizationId,
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    retry: (failureCount, error) => {
      if (isMissingTableError(error)) return false;
      return failureCount < 1;
    },
    queryFn: async (): Promise<number> => {
      if (!userId || !organizationId) return 0;
      const { count, error } = await supabase
        .from('review_comment_notifications')
        .select('id, social_media_plans!inner(organization_id)', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
        .eq('social_media_plans.organization_id', organizationId);
      if (error) {
        if (isMissingTableError(error)) return 0;
        throw error;
      }
      return count ?? 0;
    },
  });

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const { error } = await (supabase as unknown as { rpc: (fn: string, args: { notification_ids: null }) => Promise<{ error: { message: string } | null }> }).rpc('mark_review_comment_notifications_read', { notification_ids: null });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, userId] });
    queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'unread', userId] });
  }, [userId, queryClient]);

  const markOneRead = useCallback(async (notificationId: string) => {
    if (!userId) return;
    const { error } = await (supabase as unknown as { rpc: (fn: string, args: { notification_ids: string[] }) => Promise<{ error: { message: string } | null }> }).rpc('mark_review_comment_notifications_read', { notification_ids: [notificationId] });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, userId] });
    queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'unread', userId] });
  }, [userId, queryClient]);

  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channelName = `review_comment_notifications:${userId}`;
    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'review_comment_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, userId, organizationId ?? ''] });
          queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'unread', userId, organizationId ?? ''] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'review_comment_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, userId, organizationId ?? ''] });
          queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'unread', userId, organizationId ?? ''] });
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
