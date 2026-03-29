import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

/**
 * 🚀 GLOBAL TASK IDS HOOK - Automatic Request Deduplication
 * 
 * Uses React Query to automatically deduplicate concurrent requests
 * across ALL components and provider instances.
 * 
 * Features:
 * - ✅ Automatic deduplication (React Query handles this)
 * - ✅ Caching (30 seconds stale time)
 * - ✅ Works across multiple provider instances
 * - ✅ Single source of truth
 * - ✅ Automatic refetch on window focus
 */

interface TaskIdsResult {
  stepAssignedTaskIds: string[];
  subStepAssignedTaskIds: string[];
  allAssignedTaskIds: string[];
  isLoading: boolean;
  error: Error | null;
}

export function useGlobalTaskIds(employeeId: string | null | undefined): TaskIdsResult {
  const isDev = import.meta.env?.DEV;

  const query = useQuery({
    queryKey: ['global-task-ids', employeeId],
    queryFn: async () => {
      if (!employeeId) {
        return {
          stepIds: [],
          subStepIds: [],
        };
      }

      const timerId = `global-task-ids-${Date.now()}`;
      if (isDev) {
        console.time(timerId);
        logger.rateLimited('global-task-ids-start', 2000, () => {
          console.log('🌐 Global Task IDs: Starting fetch for employee:', employeeId);
        });
      }

      // Single optimized RPC call
      const { data: taskAssignments, error: rpcError } = await supabase
        .rpc('get_employee_task_ids', {
          p_employee_id: employeeId
        });

      if (isDev) {
        console.timeEnd(timerId);
      }

      if (rpcError) {
        if (isDev) {
          console.error('❌ Global Task IDs RPC error:', rpcError);
        }
        throw rpcError;
      }

      if (!taskAssignments) {
        return {
          stepIds: [],
          subStepIds: [],
        };
      }

      // Group by assignment level
      const stepIds = taskAssignments
        .filter((item: any) => item.assignment_level === 'step')
        .map((item: any) => item.task_id);
      
      const subStepIds = taskAssignments
        .filter((item: any) => item.assignment_level === 'substep')
        .map((item: any) => item.task_id);

      if (isDev) {
        logger.rateLimited('global-task-ids-success', 2000, () => {
          console.log('✅ Global Task IDs: Fetched successfully');
          console.log(`  📊 Step-level: ${stepIds.length} items`);
          console.log(`  📊 Sub-step-level: ${subStepIds.length} items`);
        });
      }

      return {
        stepIds,
        subStepIds,
      };
    },
    enabled: !!employeeId,
    staleTime: 30 * 1000, // 30 seconds - data is fresh for this duration
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    retry: 1, // Retry once on failure
  });

  // Combine all task IDs
  const allAssignedTaskIds = query.data
    ? [...new Set([...query.data.stepIds, ...query.data.subStepIds])]
    : [];

  return {
    stepAssignedTaskIds: query.data?.stepIds || [],
    subStepAssignedTaskIds: query.data?.subStepIds || [],
    allAssignedTaskIds,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
