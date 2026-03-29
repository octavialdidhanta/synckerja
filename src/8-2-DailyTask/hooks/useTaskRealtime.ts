import { useEffect, useRef } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { throttle, clearCache } from '../utils/optimizationUtils';
import { logger } from '@/shared/lib/logger';

interface UseTaskRealtimeOptions {
  organizationId: string | null;
  onRefresh: () => void;
  recentlyUpdatedTasksRef: React.MutableRefObject<Set<string>>;
}

/**
 * Hook to handle real-time subscriptions for tasks
 */
export const useTaskRealtime = ({
  organizationId,
  onRefresh,
  recentlyUpdatedTasksRef,
}: UseTaskRealtimeOptions) => {
  useEffect(() => {
    if (!organizationId) return;

    // Create throttled refresh function (max once every 5 seconds)
    const throttledRefresh = throttle(() => {
      logger.realtime('🔄 Throttled refresh triggered');
      clearCache(`tasks_${organizationId}_*`); // Clear cache for all users to get fresh data
      onRefresh(); // Force refresh to bypass cache
    }, 5000); // 5 seconds

    // OPTIMIZED: Only subscribe to main tasks table
    // All changes to steps, files, etc will be reflected through tasks
    const tasksChannel = supabase
      .channel('daily-tasks-main')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_tasks',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          logger.realtime('📡 Real-time tasks update:', payload.eventType);

          // Skip refresh if this task was recently updated by us (optimization for status updates)
          const taskId = payload.new?.id || payload.old?.id;
          if (taskId && recentlyUpdatedTasksRef.current.has(taskId)) {
            logger.realtime('⏭️ Skipping refresh for recently updated task:', taskId);
            return;
          }

          throttledRefresh();
        }
      )
      .subscribe();

    logger.realtime('✅ Real-time subscriptions setup (OPTIMIZED)');

    // Cleanup subscriptions
    return () => {
      logger.realtime('🧹 Cleaning up real-time subscriptions');
      supabase.removeChannel(tasksChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]); // Only depend on organizationId, onRefresh is stable from useCallback
};

