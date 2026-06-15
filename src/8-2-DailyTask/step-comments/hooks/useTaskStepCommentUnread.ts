import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { fetchTaskStepCommentUnreadCount } from '../services/taskStepCommentService';

export function taskStepCommentUnreadQueryKey(taskStepId: string) {
  return ['task-step-comment-unread', taskStepId] as const;
}

export function useTaskStepCommentUnread(taskStepId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled || !taskStepId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase
      .channel(`task_step_comment_unread:${taskStepId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_step_comments',
          filter: `task_step_id=eq.${taskStepId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: taskStepCommentUnreadQueryKey(taskStepId) });
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, taskStepId, queryClient]);

  const query = useQuery({
    queryKey: taskStepId ? taskStepCommentUnreadQueryKey(taskStepId) : ['task-step-comment-unread', 'disabled'],
    enabled: enabled && Boolean(taskStepId),
    queryFn: async () => {
      if (!taskStepId) return 0;
      return fetchTaskStepCommentUnreadCount(taskStepId);
    },
    staleTime: 10_000,
  });

  return {
    unreadCount: query.data ?? 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
