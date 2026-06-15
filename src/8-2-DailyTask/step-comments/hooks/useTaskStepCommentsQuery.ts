import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { fetchTaskStepComments } from '../services/taskStepCommentService';
import type { TaskStepComment } from '../types';

export function taskStepCommentsQueryKey(organizationId: string, taskStepId: string) {
  return ['task-step-comments', organizationId, taskStepId] as const;
}

export function useTaskStepCommentsQuery(organizationId: string | undefined, taskStepId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const enabled = Boolean(organizationId && taskStepId);
  const queryKey = useMemo(
    () => (enabled ? taskStepCommentsQueryKey(organizationId!, taskStepId!) : ['task-step-comments', 'disabled']),
    [enabled, organizationId, taskStepId],
  );

  useEffect(() => {
    if (!enabled || !taskStepId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase
      .channel(`task_step_comments:${taskStepId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_step_comments',
          filter: `task_step_id=eq.${taskStepId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: taskStepCommentsQueryKey(organizationId!, taskStepId!) });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_step_comment_reactions',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: taskStepCommentsQueryKey(organizationId!, taskStepId!) });
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
  }, [enabled, organizationId, taskStepId, queryClient]);

  return useQuery({
    queryKey,
    enabled,
    queryFn: async (): Promise<TaskStepComment[]> => {
      if (!organizationId || !taskStepId) return [];
      return fetchTaskStepComments(organizationId, taskStepId);
    },
    staleTime: 15_000,
  });
}

export function buildCommentTree(comments: TaskStepComment[]): TaskStepComment[] {
  const roots = comments.filter((c) => !c.parent_id);
  return roots;
}

export function getRepliesForComment(comments: TaskStepComment[], parentId: string): TaskStepComment[] {
  return comments.filter((c) => c.parent_id === parentId);
}
