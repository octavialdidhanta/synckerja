import { useEffect, useRef } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { clearCache } from '@/8-2-DailyTask/utils/optimizationUtils';
import { globalTaskIdsCache } from '@/8-2-DailyTask/utils/globalTaskIdsCache';
import { logger } from '@/shared/lib/logger';

interface UseTaskRealtimeOptions {
  organizationId: string | null;
  onRefresh: () => void;
  recentlyUpdatedTasksRef: React.MutableRefObject<Set<string>>;
}

const REFRESH_DEBOUNCE_MS = 400;

type TaskChangePayload = {
  eventType?: string;
  new?: { id?: string };
  old?: { id?: string };
};

/**
 * Refresh the daily task list when the org's tasks change.
 * Step, sub-step, assignment, and due-date writes bump daily_tasks.updated_at,
 * so this single subscription covers those updates too.
 */
export const useTaskRealtime = ({
  organizationId,
  onRefresh,
  recentlyUpdatedTasksRef,
}: UseTaskRealtimeOptions) => {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!organizationId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        logger.realtime('Refreshing daily tasks from realtime');
        clearCache(`tasks_${organizationId}_*`);
        globalTaskIdsCache.clearCache();
        onRefreshRef.current();
      }, REFRESH_DEBOUNCE_MS);
    };

    const onTaskChange = (payload: TaskChangePayload) => {
      const taskId = payload.new?.id || payload.old?.id;
      if (taskId && recentlyUpdatedTasksRef.current.has(taskId)) {
        logger.realtime('Skipping refresh for locally updated task:', taskId);
        return;
      }
      scheduleRefresh();
    };

    const tasksChannel = supabase
      .channel(`daily-tasks-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_tasks',
          filter: `organization_id=eq.${organizationId}`,
        },
        onTaskChange,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.realtime('Daily task realtime subscribed');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Daily task realtime subscription failed:', status);
        }
      });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(tasksChannel);
    };
  }, [organizationId, recentlyUpdatedTasksRef]);
};
