import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Task } from '@/features/8-2-DailyTask/DailyTaskContext';
import { logger } from '@/config/logger';

interface UseBlockerCountsProps {
  filteredTasks: Task[];
}

/**
 * Custom hook for calculating blocker counts per task
 */
export const useBlockerCounts = ({ filteredTasks }: UseBlockerCountsProps) => {
  const [blockerCountByTask, setBlockerCountByTask] = useState<Record<string, number>>({});

  // Create stable string of task IDs and step counts to use as dependency
  const blockerCalculationKey = useMemo(() => {
    if (filteredTasks.length === 0) return '';
    return filteredTasks
      .map(t => `${t.id}:${(t.steps ?? []).length}`)
      .sort()
      .join('|');
  }, [filteredTasks]);
  
  // Store snapshot of filteredTasks when blockerCalculationKey changes
  const filteredTasksSnapshotRef = useRef(filteredTasks);
  useEffect(() => {
    filteredTasksSnapshotRef.current = filteredTasks;
  }, [blockerCalculationKey, filteredTasks]);
  
  useEffect(() => {
    // Prevent running if no tasks
    if (!blockerCalculationKey) {
      setBlockerCountByTask({});
      return;
    }

    let cancelled = false;
    
    const loadCounts = async () => {
      try {
        // Use snapshot from ref to avoid closure issues
        const tasksToProcess = filteredTasksSnapshotRef.current;
        
        // OPTIMIZATION: Skip blocker counting entirely if DB is overloaded
        // This is a non-critical feature that can degrade gracefully
        if (tasksToProcess.length === 0) {
          setBlockerCountByTask({});
          return;
        }

        // Collect ALL step IDs from ALL tasks at once
        const allStepIds: string[] = [];
        const taskToStepMapping: Record<string, string[]> = {};
        
        tasksToProcess.forEach(t => {
          const stepIds = (t.steps ?? []).map(s => s.id);
          taskToStepMapping[t.id] = stepIds;
          allStepIds.push(...stepIds);
        });

        if (allStepIds.length === 0) {
          setBlockerCountByTask({});
          return;
        }

        // SINGLE BATCHED QUERY #1: Get all sub-steps for all tasks at once
        type SubStepRow = { id: string; parent_step_id: string };
        let allSubSteps: SubStepRow[] = [];
        try {
          const { data, error } = await supabase
            .from('task_steps_to_steps')
            .select('id, parent_step_id')
            .in('parent_step_id', allStepIds);
          const rows = (data as unknown as SubStepRow[] | null) ?? [];
          if (!error && rows.length) {
            allSubSteps = rows;
          }
        } catch (err) {
          logger.warn('Failed to fetch sub-steps:', err);
          // Continue with empty sub-steps
        }

        if (cancelled) return;

        const allSubStepIds = allSubSteps.map(s => s.id);
        
        // SINGLE BATCHED QUERY #2: Get ALL blocker counts for ALL steps at once (only unresolved)
        type BlockerRow = { task_step_id: string; is_resolved: boolean | null };
        let stepBlockers: BlockerRow[] = [];
        try {
          const { data, error } = await supabase
            .from('task_step_history')
            .select('task_step_id, is_resolved')
            .eq('action_type', 'blocker_added')
            .in('task_step_id', allStepIds);
          const rows = (data as unknown as BlockerRow[] | null) ?? [];
          if (!error && rows.length) {
            stepBlockers = rows.filter((b) => b.is_resolved === null || b.is_resolved === false);
          }
        } catch (err) {
          logger.warn('Failed to count step blockers:', err);
          // Continue with empty blockers - graceful degradation
        }

        if (cancelled) return;

        // SINGLE BATCHED QUERY #3: Get ALL blocker counts for ALL sub-steps at once (only unresolved)
        type SubStepBlockerRow = { task_steps_to_steps_id: string; is_resolved: boolean | null };
        let subStepBlockers: SubStepBlockerRow[] = [];
        if (allSubStepIds.length > 0) {
          try {
            const { data, error } = await supabase
              .from('task_step_history')
              .select('task_steps_to_steps_id, is_resolved')
              .eq('action_type', 'blocker_added')
              .in('task_steps_to_steps_id', allSubStepIds);
            const rows = (data as unknown as SubStepBlockerRow[] | null) ?? [];
            if (!error && rows.length) {
              subStepBlockers = rows.filter((b) => b.is_resolved === null || b.is_resolved === false);
            }
          } catch (err) {
            logger.warn('Failed to count sub-step blockers:', err);
            // Continue with empty blockers - graceful degradation
          }
        }

        if (cancelled) return;

        // Map sub-steps to their parent steps
        const subStepToParent: Record<string, string> = {};
        allSubSteps.forEach(sub => {
          subStepToParent[sub.id] = sub.parent_step_id;
        });

        // Count blockers per task
        const counts: Record<string, number> = {};
        tasksToProcess.forEach(task => {
          const taskStepIds = taskToStepMapping[task.id];
          let count = 0;

          // Count step blockers
          stepBlockers.forEach(blocker => {
            if (taskStepIds.includes(blocker.task_step_id)) {
              count++;
            }
          });

          // Count sub-step blockers
          subStepBlockers.forEach(blocker => {
            const parentStepId = subStepToParent[blocker.task_steps_to_steps_id];
            if (parentStepId && taskStepIds.includes(parentStepId)) {
              count++;
            }
          });

          counts[task.id] = count;
        });
        
        // Only update state if not cancelled
        if (!cancelled) {
          setBlockerCountByTask(counts);
        }
      } catch (e) {
        logger.warn('Error loading blocker counts:', e);
        // Graceful degradation: Show tasks without blocker counts
        setBlockerCountByTask({});
      }
    };
    
    // Debounce the loading to reduce query spam
    const timeoutId = setTimeout(loadCounts, 300);
    
    // Cleanup function to cancel if component unmounts or dependencies change
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [blockerCalculationKey]); // Only depend on blockerCalculationKey

  return { blockerCountByTask };
};

