import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';
import type { Task } from '../types';

const BLOCKER_CHUNK_TIMEOUT_MS = 9000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN = 30000;

export function useTaskListBlockers(
  filteredTasks: Task[],
  getVisibleSteps: (task: Task) => { id: string }[]
) {
  const [blockerCountByTask, setBlockerCountByTask] = useState<Record<string, number>>({});
  const [blockerModalOpen, setBlockerModalOpen] = useState(false);
  const [blockerModalItems, setBlockerModalItems] = useState<any[]>([]);
  const blockerErrorCountRef = useRef(0);
  const blockerLastErrorRef = useRef<number>(0);
  const blockerCountFetchedForRef = useRef<Set<string>>(new Set());

  const blockerCalculationKey = useMemo(() => {
    if (filteredTasks.length === 0) return '';
    return filteredTasks
      .map((t) => `${t.id}:${t.steps.length}`)
      .sort()
      .join('|');
  }, [filteredTasks]);

  const fetchBlockerCountForTasks = useCallback(async (taskIds: string[]) => {
    const notFetched = taskIds.filter((id) => !blockerCountFetchedForRef.current.has(id));
    if (notFetched.length === 0) return;
    if (blockerErrorCountRef.current >= CIRCUIT_BREAKER_THRESHOLD) {
      const since = Date.now() - blockerLastErrorRef.current;
      if (since < CIRCUIT_BREAKER_COOLDOWN) return;
      blockerErrorCountRef.current = 0;
    }
    notFetched.forEach((id) => blockerCountFetchedForRef.current.add(id));
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), BLOCKER_CHUNK_TIMEOUT_MS)
      );
      const result = await Promise.race([
        (supabase as any).rpc('get_unresolved_blocker_counts', { task_ids: notFetched }),
        timeoutPromise,
      ]) as { data?: Array<{ task_id: string; blocker_count: number }>; error?: any };
      const { data, error } = result || {};
      if (error) {
        notFetched.forEach((id) => blockerCountFetchedForRef.current.delete(id));
        blockerErrorCountRef.current++;
        blockerLastErrorRef.current = Date.now();
        const is500 =
          String(error?.code || error?.status || '').includes('500') ||
          (error?.message || '').includes('500') ||
          (error?.message || '').toLowerCase().includes('internal server');
        if (is500) blockerErrorCountRef.current = CIRCUIT_BREAKER_THRESHOLD;
        if (import.meta.env.DEV) logger.debug('Blocker counts RPC (lazy):', error?.message || error);
        return;
      }
      blockerErrorCountRef.current = 0;
      const counts: Record<string, number> = {};
      if (Array.isArray(data)) {
        data.forEach((row: any) => {
          if (row?.task_id) counts[row.task_id] = (counts[row.task_id] ?? 0) + (row.blocker_count ?? 0);
        });
      }
      notFetched.forEach((id) => {
        if (counts[id] === undefined) counts[id] = 0;
      });
      setBlockerCountByTask((prev) => ({ ...prev, ...counts }));
    } catch (e: any) {
      notFetched.forEach((id) => blockerCountFetchedForRef.current.delete(id));
      blockerErrorCountRef.current++;
      blockerLastErrorRef.current = Date.now();
      if (e?.message === 'Request timeout' && import.meta.env.DEV)
        logger.debug('Blocker counts (lazy) timeout');
    }
  }, []);

  useEffect(() => {
    if (!blockerCalculationKey) {
      setBlockerCountByTask({});
      blockerCountFetchedForRef.current = new Set();
      blockerErrorCountRef.current = 0;
      return;
    }
    setBlockerCountByTask({});
    blockerCountFetchedForRef.current = new Set();
  }, [blockerCalculationKey]);

  const openTaskBlockers = useCallback(
    async (task: Task) => {
      setBlockerModalItems([]);
      setBlockerModalOpen(true);

      try {
        const visibleSteps = getVisibleSteps(task);
        const stepIds = visibleSteps.map((s) => s.id);

        const subStepsPromise =
          stepIds.length > 0
            ? supabase
                .from('task_steps_to_steps')
                .select('id, title, parent_step_id')
                .in('parent_step_id', stepIds)
            : Promise.resolve({ data: [], error: null });

        const stepHistoryPromise =
          stepIds.length > 0
            ? Promise.race([
                supabase
                  .from('task_step_history')
                  .select('*')
                  .eq('action_type', 'blocker_added')
                  .in('task_step_id', stepIds)
                  .order('created_at', { ascending: false })
                  .limit(50),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Query timeout')), 1500)
                ),
              ]).catch(() => ({ data: null, error: { message: 'Timeout' } }))
            : Promise.resolve({ data: [], error: null });

        const [subStepsResult, stepHistoryResult] = (await Promise.all([
          subStepsPromise,
          stepHistoryPromise,
        ])) as any[];

        const subSteps = subStepsResult?.data || [];
        const subById: Record<string, any> = {};
        subSteps.forEach((s: any) => {
          subById[s.id] = s;
        });
        const subIds = subSteps.map((s: any) => s.id);

        let subStepHistoryResult: any = { data: [], error: null };
        if (subIds.length > 0) {
          subStepHistoryResult = await Promise.race([
            supabase
              .from('task_step_history')
              .select('*')
              .eq('action_type', 'blocker_added')
              .in('task_steps_to_steps_id', subIds)
              .order('created_at', { ascending: false })
              .limit(50),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Query timeout')), 1500)
            ),
          ]).catch(() => ({ data: null, error: { message: 'Timeout' } }));
        }

        let allHistory: any[] = [];
        if (stepHistoryResult?.data) {
          const unresolvedStepHistory = stepHistoryResult.data.filter(
            (h: any) => h.is_resolved === null || h.is_resolved === false
          );
          allHistory = [...allHistory, ...unresolvedStepHistory];
        }
        if (subStepHistoryResult?.data) {
          const unresolvedSubStepHistory = subStepHistoryResult.data.filter(
            (h: any) => h.is_resolved === null || h.is_resolved === false
          );
          allHistory = [...allHistory, ...unresolvedSubStepHistory];
        }
        allHistory.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const createdByUserIds = [...new Set(allHistory.map((h: any) => h.created_by).filter(Boolean))];
        let employeeMap: Record<string, any> = {};
        if (createdByUserIds.length > 0) {
          try {
            const { data: employeesData, error: employeesError } = await supabase
              .from('employees')
              .select('id, full_name, user_id')
              .in('user_id', createdByUserIds);
            if (!employeesError && employeesData) {
              employeesData.forEach((emp: any) => {
                if (emp.user_id) employeeMap[emp.user_id] = emp;
              });
            }
          } catch {
            // ignore
          }
        }

        const enriched = allHistory.map((h: any) => {
          const step = task.steps.find((s) => s.id === h.task_step_id) || null;
          const sub = h.task_steps_to_steps_id ? subById[h.task_steps_to_steps_id] : null;
          const createdByEmployee = h.created_by ? employeeMap[h.created_by] : null;
          return {
            ...h,
            taskTitle: task.title,
            stepTitle:
              step?.title ||
              (sub ? (task.steps.find((s) => s.id === sub.parent_step_id)?.title || '-') : '-') ||
              '-',
            subStepTitle: sub?.title || null,
            created_by_employee: createdByEmployee
              ? { full_name: createdByEmployee.full_name }
              : null,
          };
        });

        setBlockerModalItems(enriched);
      } catch (error) {
        console.error('Error in openTaskBlockers:', error);
        setBlockerModalItems([]);
      }
    },
    [getVisibleSteps]
  );

  return {
    blockerCountByTask,
    blockerModalOpen,
    setBlockerModalOpen,
    blockerModalItems,
    openTaskBlockers,
    fetchBlockerCountForTasks,
    blockerCountFetchedForRef,
  };
}
