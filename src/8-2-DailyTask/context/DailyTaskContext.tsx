/* @refresh reset */
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { retryableQuery } from '@/shared/lib/supabaseRetry';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { getCached, setCache, clearCache, trackQuery } from '../utils/optimizationUtils';
import {
  useTaskFilterState,
  useTaskFilters,
  useTaskRealtime,
  type TaskFilters,
} from '@/shared/hooks/daily-task';
import { logger } from '@/shared/lib/logger';
import { globalTaskIdsCache } from '../utils/globalTaskIdsCache';
import {
  Task,
  TaskStep,
  TaskLink,
  TaskFile,
  DeadlineHistory,
  RecentStepUpdate,
  SummaryData,
  RecentStepFilters,
} from '../types';
export type { Task, TaskStep } from '../types';

import { calculateProgress, determineStatusFromProgress, autoReorderTaskSteps, getEffectiveProgressAndCount } from '../utils/taskUtils';
import { filterRecentStepUpdates } from '../utils/filterUtils';
import { fetchRecentStepUpdates as fetchRecentStepUpdatesService } from '../services/recentStepUpdateService';
import {
  createCompletionApprovalIfAssignee,
  fetchRejectedForAssignee,
  isStaleLinkRemovalRejection,
} from '../services/completionApprovalService';

// Helper function to batch process large ID arrays (Supabase has limits on .in() queries)
// Optimized batch size to balance between speed and stability
const BATCH_SIZE = 10; // Balanced batch size - small enough to prevent 500 errors, large enough for speed
const MAX_RETRIES = 1; // Reduced retries for faster failure detection (was 2)
const QUERY_TIMEOUT = 20000; // Increased to 20 seconds timeout per query to handle slow database queries

// Prevent duplicate initial load when React Strict Mode double-mounts (dev only)
const INITIAL_LOAD_DEDUPE_MS = 2500;
let initialLoadState: { orgId: string; at: number } | null = null;

const batchQuery = async <T,>(
  ids: string[],
  queryFn: (batch: string[]) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> => {
  if (ids.length === 0) return [];
  
  // If IDs fit in one batch, query directly with retry
  if (ids.length <= BATCH_SIZE) {
    let lastError: any = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await queryFn(ids);
        if (!result.error) {
          return result.data || [];
        }
        lastError = result.error;
        // Don't retry on 4xx errors (client errors)
        if (result.error?.status >= 400 && result.error?.status < 500) {
          break;
        }
        // Wait before retry (exponential backoff)
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    logger.warn('Batch query failed after retries:', lastError);
    return [];
  }
  
  // Split into batches and query in parallel with retry
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    batches.push(ids.slice(i, i + BATCH_SIZE));
  }
  
  // Process batches in parallel but limit concurrency to avoid overwhelming database
  // Use Promise.allSettled for parallel execution with error handling
  const CONCURRENT_BATCHES = 5; // Process 5 batches at a time for better speed (increased from 3)
  
  const batchResults: PromiseSettledResult<T[]>[] = [];
  
  // Process batches in chunks to limit concurrency
  for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
    const batchChunk = batches.slice(i, i + CONCURRENT_BATCHES);
    
    const chunkResults = await Promise.allSettled(
      batchChunk.map(async (batch) => {
        let lastError: any = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT)
            );
            
            const queryPromise = queryFn(batch);
            const result = await Promise.race([queryPromise, timeoutPromise]) as any;
            
            if (!result.error) {
              return result.data || [];
            }
            lastError = result.error;
            // Don't retry on 4xx errors or timeout
            if (result.error?.status >= 400 && result.error?.status < 500) {
              break;
            }
            if (attempt < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt))); // Reduced delay
            }
          } catch (error: any) {
            lastError = error;
            // Skip retry on timeout
            if (error?.message?.includes('timeout')) {
              break;
            }
            if (attempt < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt))); // Reduced delay
            }
          }
        }
        if (lastError) {
          if (!lastError?.message?.includes('timeout')) {
            logger.warn('Batch query failed after retries:', lastError);
          }
        }
        return [];
      })
    );
    
    batchResults.push(...chunkResults);
    
    // Very small delay between chunks (only if not last chunk) to prevent overwhelming database
    if (i + CONCURRENT_BATCHES < batches.length) {
      await new Promise(resolve => setTimeout(resolve, 10)); // Minimal 10ms delay for speed
    }
  }
  
  // Combine all successful results
  return batchResults.flatMap(result => 
    result.status === 'fulfilled' ? result.value : []
  );
};

export interface DailyTaskContextType {
  tasks: Task[];
  filteredTasks: Task[];
  getVisibleSteps: (task: Task) => TaskStep[];
  summaryData: SummaryData;
  recentStepUpdates: RecentStepUpdate[];
  filteredRecentStepUpdates: RecentStepUpdate[];
  recentStepFilters: RecentStepFilters;
  filters: TaskFilters;
  isLoading: boolean;
  expandedTasks: Set<string>;
  setExpandedTasks: (expandedTasks: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  highlightedTask: string | null;
  setHighlightedTask: (taskId: string | null) => void;
  setFilters: (filters: TaskFilters | ((prev: TaskFilters) => TaskFilters)) => void;
  /** Reset all filters to default (e.g. when clicking Refresh to show full task list). */
  resetFilters: () => void;
  setRecentStepFilters: (filters: RecentStepFilters | ((prev: RecentStepFilters) => RecentStepFilters)) => void;
  addTask: (data: Partial<Task>) => Promise<void>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addTaskStep: (taskId: string, title: string, description?: string) => Promise<void>;
  updateTaskStep: (stepId: string, data: Partial<TaskStep>, options?: { autoReorder?: boolean }) => Promise<void>;
  deleteTaskStep: (stepId: string) => Promise<void>;
  assignTaskStep: (stepId: string, employeeId: string | null, dueDateIso?: string | null) => Promise<void>;
  reorderTaskSteps: (taskId: string, stepIds: string[]) => Promise<void>;
  uploadTaskFile: (taskId: string, file: File) => Promise<void>;
  uploadTaskStepFile: (taskStepId: string, file: File) => Promise<void>;
  deleteTaskFile: (fileId: string) => Promise<void>;
  calculateTaskProgress: (taskId: string) => number;
  requestDeadlineExtension: (taskId: string, newDeadline: string, reason: string) => Promise<void>;
  approveDeadlineExtension: (historyId: string) => Promise<void>;
  rejectDeadlineExtension: (historyId: string) => Promise<void>;
  navigateToTask: (taskId: string, stepId?: string) => void;
  scrollToStep: (stepId: string) => void;
  refetchTasks: () => Promise<void>;
  /** Optimistic update: uncheck task/step/substep in local state (e.g. after reject in pending approval). */
  uncheckCompletionLocally: (params: {
    entityType: 'task' | 'step' | 'substep';
    dailyTaskId: string;
    taskStepId?: string | null;
    taskStepsToStepsId?: string | null;
  }) => void;
  applyApprovalDecisionLocally: (params: {
    entityType: 'task' | 'step' | 'substep';
    dailyTaskId: string;
    decision: 'approve' | 'reject' | 'unapprove';
    taskStepId?: string | null;
    taskStepsToStepsId?: string | null;
  }) => void;
  /** Rejection reason by task id (for main table task row). */
  rejectedReasonsByTaskId: Record<string, string>;
  /** Rejection reason by step id (for main table "Reason for Rejection" + Revision badge). */
  rejectedReasonsByStepId: Record<string, string>;
  /** Rejection reason by sub-step id (for main table). */
  rejectedReasonsBySubStepId: Record<string, string>;
  /** Focus from "Pending your approval" click: show only one task/step; cleared on refetch. */
  pendingApprovalFocus: { taskId: string; stepId?: string; openSubStepModalForStepId?: string } | null;
  setPendingApprovalFocus: (v: { taskId: string; stepId?: string; openSubStepModalForStepId?: string } | null) => void;
  /** When true, task/step row uses amber highlight (from pending approval). */
  highlightFromPendingApproval: boolean;
  /** Tasks to display: when pendingApprovalFocus.taskId set, only that task; else filteredTasks. */
  effectiveFilteredTasks: Task[];
  /** Visible steps: when pendingApprovalFocus.stepId set for task, only that step; else getVisibleSteps. */
  getVisibleStepsEffective: (task: Task) => TaskStep[];
  /** Lazy-load recent step updates (e.g. when Summary tab is opened). */
  fetchRecentStepUpdates: () => Promise<void>;
  /** Map task id -> department { id, name } for display and filter (same source as desktop). */
  departmentMap: Record<string, { id: string; name: string }>;
}

const DailyTaskContext = createContext<DailyTaskContextType | undefined>(undefined);

export const useDailyTask = () => {
  const context = useContext(DailyTaskContext);
  if (!context) {
    throw new Error('useDailyTask must be used within a DailyTaskProvider');
  }
  return context;
};

/** Returns context or undefined when not inside DailyTaskProvider (e.g. Home page standalone). */
export const useDailyTaskOptional = () => useContext(DailyTaskContext);

interface DailyTaskProviderProps {
  children: ReactNode;
}

export const DailyTaskProvider = ({ children }: DailyTaskProviderProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentStepUpdates, setRecentStepUpdates] = useState<RecentStepUpdate[]>([]);
  const [filteredRecentStepUpdates, setFilteredRecentStepUpdates] = useState<RecentStepUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Track recently updated tasks to skip real-time refresh (optimization for status updates)
  const recentlyUpdatedTasksRef = useRef<Set<string>>(new Set());
  // Track tasks that have been auto-fixed for has_reminder to avoid duplicate updates
  const autoFixedReminderRef = useRef<Set<string>>(new Set());
  
  // Track previous task IDs to only log when changed
  const prevTaskIdsRef = useRef<{
    taskLevel: string[];
    stepLevel: string[];
    subStepLevel: string[];
    combined: string[];
  }>({
    taskLevel: [],
    stepLevel: [],
    subStepLevel: [],
    combined: []
  });
  // Lazy load task_files: track which tasks have had files loaded (reset on full fetch)
  const taskIdsWithFilesLoadedRef = useRef<Set<string>>(new Set());

  // Use custom hook for filter state with localStorage persistence
  const { filters, setFilters, resetFilters } = useTaskFilterState({
    onStorageError: (msg) =>
      toast({ title: 'Warning', description: msg, variant: 'destructive' }),
  });
  const [recentStepFilters, setRecentStepFilters] = useState<RecentStepFilters>({
    dateRange: 'today',
    actionType: 'all'
  });
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [highlightedTask, setHighlightedTask] = useState<string | null>(null);
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { data: currentEmployee } = useCurrentEmployee();
  const { isOwner } = useCentralizedUserData();
  const [departmentMap, setDepartmentMap] = useState<Record<string, { id: string; name: string }>>({});
  const [rejectedReasonsByTaskId, setRejectedReasonsByTaskId] = useState<Record<string, string>>({});
  const [rejectedReasonsByStepId, setRejectedReasonsByStepId] = useState<Record<string, string>>({});
  const [rejectedReasonsBySubStepId, setRejectedReasonsBySubStepId] = useState<Record<string, string>>({});
  const [pendingApprovalFocus, setPendingApprovalFocus] = useState<{
    taskId: string;
    stepId?: string;
    openSubStepModalForStepId?: string;
  } | null>(null);

  // Centralized fetch functions - only called when Summary tab is mounted (lazy load)
  const fetchRecentStepUpdates = useCallback(async () => {
    if (!organizationId) return;
    try {
      const recentUpdates = await fetchRecentStepUpdatesService(organizationId);
      setRecentStepUpdates(recentUpdates);
    } catch (error) {
      logger.warn('Error fetching recent step updates:', error);
    }
  }, [organizationId]);

  // Defer department fetch so initial task list renders first (keeps page load fast)
  const DEFER_DEPARTMENT_FETCH_MS = 500;
  useEffect(() => {
    if (!tasks || tasks.length === 0) {
      setDepartmentMap({});
      return;
    }
    const t = setTimeout(async () => {
      const taskIds = tasks.map((t) => t.id);
      try {
        const { data: assignments, error: assignmentError } = await supabase
          .from('daily_tasks_assigned')
          .select(`
            daily_task_id,
            department_id,
            employee_id,
            employee:employees!employee_id(department_id)
          `)
          .in('daily_task_id', taskIds);
        if (assignmentError) return;
        const departmentIds = new Set<string>();
        const taskDeptMapping: Array<{ taskId: string; deptId: string }> = [];
        (assignments || []).forEach((assignment: any) => {
          let deptId = assignment.department_id;
          if (!deptId && assignment.employee_id && assignment.employee?.department_id) {
            deptId = assignment.employee.department_id;
          }
          if (deptId) {
            departmentIds.add(deptId);
            taskDeptMapping.push({ taskId: assignment.daily_task_id, deptId });
          }
        });
        if (departmentIds.size === 0) {
          setDepartmentMap({});
          return;
        }
        const { data: departments, error: deptError } = await supabase
          .from('departments')
          .select('id, name')
          .in('id', Array.from(departmentIds));
        if (deptError) return;
        const deptMap: Record<string, { id: string; name: string }> = {};
        (departments || []).forEach((dept: any) => {
          deptMap[dept.id] = { id: dept.id, name: dept.name };
        });
        const taskDeptMap: Record<string, { id: string; name: string }> = {};
        taskDeptMapping.forEach(({ taskId, deptId }) => {
          if (deptMap[deptId]) taskDeptMap[taskId] = deptMap[deptId];
        });
        setDepartmentMap(taskDeptMap);
      } catch {
        setDepartmentMap({});
      }
    }, DEFER_DEPARTMENT_FETCH_MS);
    return () => clearTimeout(t);
  }, [tasks]);

  const { filteredTasks, filteredSummaryData, getVisibleSteps } = useTaskFilters({
    tasks,
    filters,
    currentUserId: user?.id,
    currentEmployeeId: currentEmployee?.id,
    departmentMap,
    isOwner,
  });

  const highlightFromPendingApproval = pendingApprovalFocus !== null;

  const effectiveFilteredTasks = useMemo(() => {
    if (pendingApprovalFocus?.taskId) {
      return tasks.filter((t) => t.id === pendingApprovalFocus.taskId);
    }
    return filteredTasks;
  }, [pendingApprovalFocus?.taskId, tasks, filteredTasks]);

  const getVisibleStepsEffective = useCallback(
    (task: Task): TaskStep[] => {
      if (pendingApprovalFocus?.stepId && task.id === pendingApprovalFocus.taskId) {
        const step = task.steps?.find((s) => s.id === pendingApprovalFocus.stepId);
        return step ? [step] : [];
      }
      return getVisibleSteps(task);
    },
    [pendingApprovalFocus?.taskId, pendingApprovalFocus?.stepId, getVisibleSteps]
  );

  const fetchTasks = async (force = false) => {
    if (!organizationId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const isDev = import.meta.env.DEV;
      if (isDev) {
        logger.query('ðŸ” Fetching tasks for organization:', organizationId);
      }
      trackQuery('fetch_tasks');
      
      // Get current user - fail fast if slow (2s max)
      const getUserPromise = supabase.auth.getUser();
      const getUserTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getUser timeout')), 2000)
      );
      
      let user: any = null;
      try {
        const result = await Promise.race([getUserPromise, getUserTimeout]);
        user = (result as any)?.data?.user;
      } catch {
        // Jangan setTasks([]): effect bisa re-run; panggilan lain mungkin sudah set tasks dari cache/sukses. Hanya set loading false.
        setIsLoading(false);
        return;
      }
      
      if (!user) {
        if (import.meta.env.DEV) {
          logger.debug('âš ï¸ No authenticated user found');
        }
        // Jangan setTasks([]): jangan overwrite data sukses dari run lain (effect re-run).
        setIsLoading(false);
        return;
      }

      // Check cache first (60 seconds cache - INCREASED to save IO)
      // Cache key includes user ID to ensure user-specific caching
      const cacheKey = `tasks_${organizationId}_${user.id}`;
      if (!force) {
        const cached = getCached<any[]>(cacheKey, 60000); // 60s instead of 30s
        if (cached) {
          setTasks(cached);
          setIsLoading(false);
          return;
        }
      }

      // Get current employee ID to filter assigned tasks
      const { data: currentEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (isDev) {
        logger.userData('ðŸ‘¤ Current user:', user.id);
        logger.userData('ðŸ‘¨â€ðŸ’¼ Current employee:', currentEmployee?.id);
      }

      // Get tasks assigned to current user at TASK level
      let assignedTaskIds: string[] = [];
      if (currentEmployee?.id) {
        const { data: assignedTasks } = await supabase
          .from('daily_tasks_assigned')
          .select('daily_task_id')
          .eq('employee_id', currentEmployee.id)
          .limit(1000); // Limit to prevent statement timeout
        
        assignedTaskIds = (assignedTasks || []).map((a: any) => a.daily_task_id);
        // Only log if data changed
        if (isDev) {
          const prevIds = prevTaskIdsRef.current.taskLevel;
          const idsChanged = JSON.stringify(assignedTaskIds.sort()) !== JSON.stringify(prevIds.sort());
          if (idsChanged) {
            logger.debug('ðŸ“‹ Task-level assigned IDs:', assignedTaskIds);
            prevTaskIdsRef.current.taskLevel = assignedTaskIds;
          }
        }
      }

      // ðŸŒ GLOBAL DEDUPLICATION: Use singleton cache across all provider instances
      // This reduces database load by 90%+ when multiple providers mount simultaneously
      let stepAssignedTaskIds: string[] = [];
      let subStepAssignedTaskIds: string[] = [];
      
      if (currentEmployee?.id) {
        try {
          const taskIdsData = await globalTaskIdsCache.getTaskIds(currentEmployee.id);
          stepAssignedTaskIds = taskIdsData.stepIds;
          subStepAssignedTaskIds = taskIdsData.subStepIds;
        } catch (error) {
          if (isDev) {
            console.error('âŒ Global cache error:', error);
          }
          // Continue with empty arrays on error
        }

        // Only log if data changed (now applies to all paths)
        if (isDev && stepAssignedTaskIds.length > 0) {
          const prevStepIds = prevTaskIdsRef.current.stepLevel;
          const stepIdsChanged = JSON.stringify(stepAssignedTaskIds.sort()) !== JSON.stringify(prevStepIds.sort());
          if (stepIdsChanged) {
            const label = `âš¡ Optimized step-level IDs: ${stepAssignedTaskIds.length} items`;
            logger.rateLimited('step-assigned-ids', 3000, () => {
              logger.groupCollapsed(label, () => {
                logger.debug(stepAssignedTaskIds);
              });
            });
            prevTaskIdsRef.current.stepLevel = stepAssignedTaskIds;
          }

          const prevSubStepIds = prevTaskIdsRef.current.subStepLevel;
          const subStepIdsChanged = JSON.stringify(subStepAssignedTaskIds.sort()) !== JSON.stringify(prevSubStepIds.sort());
          if (subStepIdsChanged) {
            const label = `âš¡ Optimized sub-step-level IDs: ${subStepAssignedTaskIds.length} items`;
            logger.rateLimited('substep-assigned-ids', 3000, () => {
              logger.groupCollapsed(label, () => {
                logger.debug(subStepAssignedTaskIds);
              });
            });
            prevTaskIdsRef.current.subStepLevel = subStepAssignedTaskIds;
          }
        }
      }

      // Include tasks where current user is assigner (so assigner still sees task after rejecting, not only when "Pending approval")
      let assignerTaskIds: string[] = [];
      if (currentEmployee?.id) {
        try {
          const [stepAssignerRes, subStepAssignerRes] = await Promise.all([
            supabase.from('task_steps_assigned').select('task_step_id').eq('assigned_by', currentEmployee.id).limit(1000),
            supabase.from('task_steps_to_steps_assigned').select('task_steps_to_steps_id').eq('assigned_by', currentEmployee.id).limit(1000),
          ]);
          const stepIds = (stepAssignerRes.data || []).map((r: { task_step_id: string }) => r.task_step_id).filter(Boolean);
          const subStepIds = (subStepAssignerRes.data || []).map((r: { task_steps_to_steps_id: string }) => r.task_steps_to_steps_id).filter(Boolean);
          const stepTaskIds =
            stepIds.length > 0
              ? (await supabase.from('task_steps').select('task_id').in('id', stepIds)).data?.map((r: { task_id: string }) => r.task_id).filter(Boolean) ?? []
              : [];
          let subStepTaskIds: string[] = [];
          if (subStepIds.length > 0) {
            const subSteps = (await supabase.from('task_steps_to_steps').select('parent_step_id').in('id', subStepIds)).data ?? [];
            const parentStepIds = subSteps.map((r: { parent_step_id: string }) => r.parent_step_id).filter(Boolean);
            if (parentStepIds.length > 0) {
              subStepTaskIds = (await supabase.from('task_steps').select('task_id').in('id', parentStepIds)).data?.map((r: { task_id: string }) => r.task_id).filter(Boolean) ?? [];
            }
          }
          assignerTaskIds = [...new Set([...stepTaskIds, ...subStepTaskIds])];
        } catch (err) {
          if (isDev) console.warn('Assigner task IDs fetch failed', err);
        }
      }

      // Include tasks created by current user (so unassigned tasks they just created appear in the list)
      let creatorTaskIds: string[] = [];
      try {
        const { data: createdTasks } = await supabase
          .from('daily_tasks')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('created_by', user.id)
          .limit(500);
        creatorTaskIds = (createdTasks || []).map((r: { id: string }) => r.id).filter(Boolean);
      } catch (err) {
        if (isDev) console.warn('Creator task IDs fetch failed', err);
      }

      // Combine task-level, step-level, sub-step-level (assignee), assigner, and creator task IDs
      const allAssignedTaskIds = [...new Set([...assignedTaskIds, ...stepAssignedTaskIds, ...subStepAssignedTaskIds, ...assignerTaskIds, ...creatorTaskIds])];
      // Only log if data changed
      if (isDev) {
        const prevIds = prevTaskIdsRef.current.combined;
        const idsChanged = JSON.stringify(allAssignedTaskIds.sort()) !== JSON.stringify(prevIds.sort());
        if (idsChanged) {
          const label = `âš¡ Optimized combined IDs: ${allAssignedTaskIds.length} items (66% fewer queries!)`;
          logger.rateLimited('combined-assigned-ids', 3000, () => {
            logger.groupCollapsed(label, () => {
              logger.debug(allAssignedTaskIds);
            });
          });
          prevTaskIdsRef.current.combined = allAssignedTaskIds;
        }
      }

      // OPTIMIZATION: Fetch only tasks relevant to user when they have assignments (faster load, especially on mobile).
      // When user has no assignments we still fetch org tasks so owners/admins see the full list.
      const MAX_ASSIGNED_TASK_IDS = 500; // Cap to avoid URL/query size limits
      const taskIdsToFetch =
        allAssignedTaskIds.length > 0
          ? allAssignedTaskIds.slice(0, MAX_ASSIGNED_TASK_IDS)
          : null;

      const dailyTasksQuery = supabase
        .from('daily_tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          finish_date,
          plan_date,
          organization_id,
          created_by,
          objective_id,
          has_substeps,
          has_reminder,
          has_steps,
          daily_template_id,
          created_at,
          updated_at
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      const { data, error } = taskIdsToFetch
        ? await dailyTasksQuery.in('id', taskIdsToFetch)
        : await dailyTasksQuery.limit(1000);

      if (error) {
        console.error('âŒ Error fetching tasks:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          organizationId
        });
        throw error;
      }
      
      if (isDev) {
        logger.query('âœ… Fetched tasks (basic data):', data);
        logger.query('ðŸ“Š Task count:', data?.length || 0);
      }
      // Debug: Log if no tasks found
      if (!data || data.length === 0) {
        console.warn('âš ï¸ No tasks found for organization:', organizationId);
        setTasks([]);
        setIsLoading(false);
        setCache(cacheKey, []);
        return;
      }

      // Fetch task steps separately - use batch processing to avoid timeout
      const taskIds = data.map(task => task.id);
      if (isDev) {
        logger.query('ðŸ” Fetching task steps for tasks:', taskIds);
      }
      
      let stepsData: any[] = [];
      if (taskIds.length > 0) {
        try {
          // Use batch processing to prevent timeout with many IDs
          const stepsBatches = await batchQuery(
            taskIds,
            async (batch) => {
              const { data, error } = await supabase
                .from('task_steps')
                .select(`
                  id,
                  task_id,
                  title,
                  description,
                  is_completed,
                  order,
                  status,
                  priority,
                  schedule_type,
                  schedule_value,
                  step_priority,
                  created_at,
                  updated_at,
                  completed_at,
                  created_by,
                  social_media_plan_id,
                  is_concept_step
                `)
                .in('task_id', batch)
                .order('order', { ascending: true });
              
              return { data: data || [], error };
            }
          );
          
          stepsData = stepsBatches;
          if (isDev) {
            logger.query('âœ… Fetched task steps:', stepsData.length);
          }
        } catch (error) {
          console.error('âŒ Error fetching task steps:', error);
          stepsData = [];
        }
      }

      // OPTIMIZED: No longer need to query completion dates from history
      // We now use completed_at column directly from task_steps table (fetched above)

      const stepIds = (stepsData || []).map(s => s.id);

      // Run assignments, step assignments, and sub-steps in parallel (log showed ~2.25s in this segment when sequential)
      let assignmentsData: any[] = [];
      let stepAssignmentsData: any[] = [];
      let subStepsData: any[] = [];

      const [assignmentsBatchesResult, stepAssignsBatchesResult, subStepsBatchesResult] = await Promise.all([
        taskIds.length > 0
          ? batchQuery(taskIds, async (batch) => {
              const { data, error } = await supabase
                .from('daily_tasks_assigned')
                .select(`
                  id,
                  daily_task_id,
                  employee_id,
                  assigned_by,
                  assigned_at,
                  employee:employees!employee_id(id, full_name),
                  assigned_by_employee:employees!assigned_by(id, full_name)
                `)
                .in('daily_task_id', batch);
              return { data: data || [], error };
            })
          : Promise.resolve([]),
        stepIds.length > 0
          ? batchQuery(stepIds, async (batch) => {
              const { data, error } = await supabase
                .from('task_steps_assigned')
                .select(`
                  id,
                  task_step_id,
                  employee_id,
                  assigned_by,
                  assigned_at,
                  employee:employees!employee_id(id, full_name, email),
                  assigned_by_employee:employees!assigned_by(id, full_name, email)
                `)
                .in('task_step_id', batch)
                .order('assigned_at', { ascending: false });
              return { data: data || [], error };
            })
          : Promise.resolve([]),
        stepIds.length > 0
          ? batchQuery(stepIds, async (batch) => {
              const { data, error } = await supabase
                .from('task_steps_to_steps')
                .select(`
                  id,
                  parent_step_id,
                  title,
                  is_completed,
                  order,
                  created_at,
                  updated_at
                `)
                .in('parent_step_id', batch)
                .order('order', { ascending: true });
              return { data: data || [], error };
            })
          : Promise.resolve([]),
      ]);

      assignmentsData = Array.isArray(assignmentsBatchesResult) ? assignmentsBatchesResult : [];
      stepAssignmentsData = Array.isArray(stepAssignsBatchesResult) ? stepAssignsBatchesResult : [];
      subStepsData = Array.isArray(subStepsBatchesResult) ? subStepsBatchesResult : [];

      if (isDev) {
        logger.query('âœ… Fetched task assignments (parallel):', assignmentsData.length);
        logger.query('âœ… Fetched step assignments (parallel):', stepAssignmentsData.length);
        logger.query('âœ… Fetched sub-steps (parallel):', subStepsData.length);
      }

      // Fetch sub-step assignments to know which parent steps have assigned sub-steps
      let subStepParentIds: string[] = [];
      let subStepAssignmentsData: any[] = [];
      if (stepIds.length > 0 && subStepsData.length > 0) {
        const subStepIds = subStepsData.map(s => s.id);
        
        // Fetch assignments for all sub-steps (not just current employee) - use batch processing
        try {
          // Use batch processing to prevent timeout with many IDs
          const subStepAssignsBatches = await batchQuery(
            subStepIds,
            async (batch) => {
              const { data, error } = await supabase
                .from('task_steps_to_steps_assigned')
                .select(`
                  id,
                  task_steps_to_steps_id,
                  employee_id,
                  assigned_by,
                  assigned_at,
                  employee:employees!employee_id(id, full_name, email)
                `)
                .in('task_steps_to_steps_id', batch)
                .order('assigned_at', { ascending: false });
              
              return { data: data || [], error };
            }
          );
          
          subStepAssignmentsData = subStepAssignsBatches;
          if (isDev) {
            logger.query('âœ… Fetched sub-step assignments:', subStepAssignmentsData.length);
          }
        } catch (error) {
          console.error('âŒ Error fetching sub-step assignments:', error);
          subStepAssignmentsData = [];
        }
        
        // Group sub-step assignments by sub-step ID
        const subStepAssignmentsBySubStepId: Record<string, any> = {};
        subStepAssignmentsData.forEach(assignment => {
          if (!subStepAssignmentsBySubStepId[assignment.task_steps_to_steps_id]) {
            subStepAssignmentsBySubStepId[assignment.task_steps_to_steps_id] = assignment;
          }
        });
        
        // Get parent step IDs that have assigned sub-steps (for current employee or any employee)
        subStepParentIds = [...new Set(
          subStepsData
            .filter(subStep => subStepAssignmentsBySubStepId[subStep.id])
            .map(subStep => subStep.parent_step_id)
            .filter(Boolean)
        )];
        if (isDev) {
          logger.debug('ðŸ“‹ Parent step IDs with assigned sub-steps:', subStepParentIds);
        }
      }

      // Task files: LAZY LOAD when user expands a task (see fetchTaskFilesForTask + useEffect on expandedTasks)
      const filesByStepId: Record<string, any[]> = {};

      // Fetch due dates for step assignments - OPTIMIZED: Load in background if too many
      let stepDueDatesData: any[] = [];
      if (stepAssignmentsData.length > 0) {
        const assignmentIds = stepAssignmentsData.map((a: any) => a.id);
        
        // If too many assignments, load due dates in background (non-blocking)
        if (assignmentIds.length > 50) {
          // Load due dates in background for large datasets
          // Store assignment mapping for later use
          const assignmentIdToStepIdMap: Record<string, string> = {};
          stepAssignmentsData.forEach(assignment => {
            if (assignment.task_step_id) {
              assignmentIdToStepIdMap[assignment.id] = assignment.task_step_id;
            }
          });
          
          (async () => {
            try {
              const dueDatesBatches = await batchQuery(
                assignmentIds,
                async (batch) => {
                  const { data, error } = await supabase
                    .from('task_steps_assigned_duedate')
                    .select('task_steps_assigned_id, due_date')
                    .in('task_steps_assigned_id', batch)
                    .order('created_at', { ascending: false });
                  
                  return { data: data || [], error };
                }
              );
              
              // Map due dates by step ID (not assignment ID) for easier update
              const dueDatesByStepId: Record<string, string> = {};
              dueDatesBatches.forEach((dueDate: any) => {
                const stepId = assignmentIdToStepIdMap[dueDate.task_steps_assigned_id];
                if (stepId && !dueDatesByStepId[stepId]) {
                  dueDatesByStepId[stepId] = dueDate.due_date;
                }
              });
              
              // Update tasks with due dates
              setTasks(prevTasks => 
                prevTasks.map(task => ({
                  ...task,
                  steps: (task.steps ?? []).map(step => {
                    const dueDate = dueDatesByStepId[step.id];
                    if (dueDate) {
                      return {
                        ...step,
                        assigned_due_date: dueDate
                      };
                    }
                    return step;
                  })
                }))
              );
            } catch (error) {
              console.warn('âš ï¸ Error fetching due dates in background (non-critical):', error);
            }
          })().catch(err => console.warn('Background due dates fetch failed:', err));
        } else {
          // For smaller datasets, load normally but with timeout
          try {
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Due dates query timeout')), 10000)
            );
            
            const queryPromise = batchQuery(
              assignmentIds,
              async (batch) => {
                const { data, error } = await supabase
                  .from('task_steps_assigned_duedate')
                  .select('task_steps_assigned_id, due_date')
                  .in('task_steps_assigned_id', batch)
                  .order('created_at', { ascending: false });
                
                return { data: data || [], error };
              }
            );
            
            stepDueDatesData = await Promise.race([queryPromise, timeoutPromise]) as any[];
          } catch (error: any) {
            // If timeout or error, continue without due dates (non-critical)
            console.warn('âš ï¸ Error/timeout fetching due dates (non-critical, continuing):', error);
            stepDueDatesData = [];
          }
        }
      }
      
      // Map due dates by assignment ID (only if loaded synchronously)
      const dueDatesByAssignmentId: Record<string, string> = {};
      if (stepDueDatesData.length > 0) {
        stepDueDatesData.forEach((dueDate: any) => {
          if (!dueDatesByAssignmentId[dueDate.task_steps_assigned_id]) {
            dueDatesByAssignmentId[dueDate.task_steps_assigned_id] = dueDate.due_date;
          }
        });
      }

      // Group step assignments by task_step_id (only keep the latest one per step)
      const stepAssignmentsByStepId: Record<string, any> = {};
      stepAssignmentsData.forEach(assignment => {
        if (!stepAssignmentsByStepId[assignment.task_step_id]) {
          stepAssignmentsByStepId[assignment.task_step_id] = {
            ...assignment,
            assigned_due_date: dueDatesByAssignmentId[assignment.id] || null
          };
        }
      });

      // Group sub-steps by parent_step_id
      const subStepsByParentStepId: Record<string, any[]> = {};
      subStepsData.forEach(subStep => {
        if (!subStepsByParentStepId[subStep.parent_step_id]) {
          subStepsByParentStepId[subStep.parent_step_id] = [];
        }
        subStepsByParentStepId[subStep.parent_step_id].push(subStep);
      });

      // Group sub-step assignments by sub-step ID
      const subStepAssignmentsBySubStepId: Record<string, any> = {};
      subStepAssignmentsData.forEach(assignment => {
        if (!subStepAssignmentsBySubStepId[assignment.task_steps_to_steps_id]) {
          subStepAssignmentsBySubStepId[assignment.task_steps_to_steps_id] = assignment;
        }
      });

      // Group steps by task_id
      const stepsByTaskId: Record<string, any[]> = {};
      (stepsData || []).forEach(step => {
        if (!stepsByTaskId[step.task_id]) {
          stepsByTaskId[step.task_id] = [];
        }
        
        // Add assignment data to step if exists
        const stepAssignment = stepAssignmentsByStepId[step.id];
        const hasAssignedSubSteps = subStepParentIds.includes(step.id);
        
        // Get sub-steps for this step
        const subSteps = (subStepsByParentStepId[step.id] || []).map((subStep: any) => {
          const subStepAssignment = subStepAssignmentsBySubStepId[subStep.id];
          return {
            ...subStep,
            assigned_to: subStepAssignment?.employee_id || null,
            assigned_employee: subStepAssignment?.employee || null
          };
        });

        stepsByTaskId[step.task_id].push({
          ...step,
          // completed_at is already included from ...step spread (fetched from database)
          assigned_to: stepAssignment?.employee_id || null,
          assigned_at: stepAssignment?.assigned_at || null,
          assigned_by: stepAssignment?.assigned_by || null,
          assigned_employee: stepAssignment?.employee || null,
          assigned_by_employee: stepAssignment?.assigned_by_employee || null,
          assigned_due_date: stepAssignment?.assigned_due_date || null,
          has_assigned_substeps: hasAssignedSubSteps, // Flag to show step if it has assigned sub-steps
          sub_steps: subSteps, // Include sub-steps data
          files: filesByStepId[step.id] || [] // Include files for this step
        });
      });

      // Group assignments by daily_task_id
      const assignmentsByTaskId: Record<string, any> = {};
      (assignmentsData || []).forEach(assignment => {
        // Only store the first assignment if there are multiple (shouldn't happen normally)
        if (!assignmentsByTaskId[assignment.daily_task_id]) {
          assignmentsByTaskId[assignment.daily_task_id] = assignment;
        }
      });
      
      // Calculate progress for each task and synchronize status
      const tasksWithProgress = (data || []).map((task: any) => {
        const taskSteps = stepsByTaskId[task.id] || [];
        const progress =
          taskSteps.length > 0
            ? getEffectiveProgressAndCount(taskSteps).progress
            : (task.status === 'completed' ? 100 : 0);
        
        // For tasks without substeps (has_substeps = false), respect the manual status
        // Don't auto-synchronize status based on progress since they can be checked directly
        let synchronizedStatus: string;
        if (task.has_substeps === false) {
          // Respect the status from database for tasks without substeps
          synchronizedStatus = task.status;
        } else {
          // For tasks with substeps, synchronize based on progress
          synchronizedStatus = determineStatusFromProgress(progress, task.status);
        }
        
        // Get assignment data for this task
        const assignment = assignmentsByTaskId[task.id];
        const assignedEmployeeName = assignment?.employee?.full_name || null;
        const assignedEmployeeId = assignment?.employee_id || null;
        const assignerName =
          assignment?.assigned_by &&
          assignment?.employee_id &&
          assignment.assigned_by !== assignment.employee_id
            ? assignment?.assigned_by_employee?.full_name?.trim() || null
            : null;
        
        // Auto-fix: If task is completed but has_reminder is true, set it to false
        let hasReminder = task.has_reminder;
        if (synchronizedStatus === 'completed' && hasReminder === true) {
          hasReminder = false;
          // Auto-fix in database (non-blocking, only once per task)
          if (!autoFixedReminderRef.current.has(task.id)) {
            autoFixedReminderRef.current.add(task.id);
            supabase
              .from('daily_tasks')
              .update({ has_reminder: false })
              .eq('id', task.id)
              .then(({ error }) => {
                if (error) {
                  console.warn('Failed to auto-fix has_reminder for task:', task.id, error);
                  autoFixedReminderRef.current.delete(task.id); // Retry on next fetch
                }
              });
          }
        }
        
        return {
          ...task,
          steps: taskSteps.map((step: any) => ({
            ...step,
            // files are already included from stepsByTaskId mapping
            links: [], // Load separately on demand
            history: [], // Load separately on demand
            // Keep assignment data that was already set in stepsByTaskId
            // assigned_to and assigned_employee are already in step from previous mapping
          })),
          deadline_history: [], // Load separately on demand
          progress_percentage: progress,
          status: synchronizedStatus,
          assigned_to: assignedEmployeeId,
          assigned_to_name: assignedEmployeeName,
          assigned_by_name: assignerName,
          has_reminder: hasReminder, // Use corrected value
          has_steps: taskSteps.length > 0, // Set based on actual steps count
          files: []
        };
      });

      // Reset lazy-loaded files cache so files are re-fetched when user expands tasks
      taskIdsWithFilesLoadedRef.current = new Set();
      setTasks(tasksWithProgress);
      setIsLoading(false);

      // Cache the results
      setCache(cacheKey, tasksWithProgress);
      
      // Update status in database for tasks that need synchronization (non-blocking)
      // Run in background to not block page load
      syncTaskStatusesInDatabase(tasksWithProgress, data || []).catch(err => 
        console.warn('Background status sync failed:', err)
      );
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setIsLoading(false);
      toast({
        title: 'Error',
        description: 'Failed to load tasks',
        variant: 'destructive'
      });
    }
  };

  const syncTaskStatusesInDatabase = async (synchronizedTasks: Task[], originalTasks: any[]) => {
    try {
      const updatesNeeded = synchronizedTasks.filter((task, index) => {
        const originalTask = originalTasks[index];
        // Don't sync status for tasks without substeps - they can be manually set
        if (task.has_substeps === false) {
          return false;
        }
        return originalTask && task.status !== originalTask.status;
      });

      if (updatesNeeded.length > 0) {
        logger.debug('Syncing task statuses in database:', updatesNeeded.map(t => ({ id: t.id, oldStatus: originalTasks.find(ot => ot.id === t.id)?.status, newStatus: t.status })));
        
        // Update status for each task that needs synchronization
        // Note: finish_date is now automatically handled by database trigger
        // When status = 'completed', trigger sets finish_date = NOW()
        // When status != 'completed', trigger sets finish_date = NULL
        for (const task of updatesNeeded) {
          const updateData: any = { status: task.status };
          
          const { error } = await supabase
            .from('daily_tasks')
            .update(updateData)
            .eq('id', task.id);
          
          if (error) {
            console.error(`Error updating status for task ${task.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing task statuses:', error);
    }
  };


  // Summary data from filtered tasks so all sections respond to filters
  const summaryData: SummaryData = filteredSummaryData;

  const addTask = async (data: Partial<Task>) => {
    if (!organizationId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be signed in to create a task.',
          variant: 'destructive',
        });
        return;
      }

      logger.debug('Adding task to database:', { ...data, organization_id: organizationId });
      
      const { data: newTask, error } = await supabase
        .from('daily_tasks')
        .insert({
          organization_id: organizationId,
          title: data.title || '',
          description: data.description || '',
          status: data.status || 'pending',
          priority: data.priority || 'medium',
          due_date: data.due_date || null,
          plan_date: (data as any).plan_date || null,
          objective_id: (data as any).objective_id || null,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // If task should be assigned, create assignment in daily_tasks_assigned
      if (data.assigned_to) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: assignedBy } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user?.id)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (assignedBy) {
          // Insert assignment record
          const { data: assignmentRecord, error: assignmentError } = await supabase
            .from('daily_tasks_assigned')
            .insert({
              organization_id: organizationId,
              daily_task_id: newTask.id,
              employee_id: data.assigned_to,
              assigned_by: assignedBy.id,
              assigned_at: new Date().toISOString()
            })
            .select()
            .single();

          if (assignmentError) {
            console.error('Error creating assignment:', assignmentError);
            toast({
              title: 'Error',
              description: 'Task created but assignment failed.',
              variant: 'destructive',
            });
          }

          // If deadline is provided, save it to task_steps_assigned_duedate table
          if (data.due_date && assignmentRecord) {
            logger.debug('ðŸ’¾ Saving deadline to task_steps_assigned_duedate:', {
              daily_tasks_assigned_id: assignmentRecord.id,
              due_date: data.due_date,
              organization_id: organizationId
            });

            const { data: deadlineRecord, error: deadlineError } = await supabase
              .from('task_steps_assigned_duedate')
              .insert({
                organization_id: organizationId,
                daily_tasks_assigned_id: assignmentRecord.id,
                due_date: data.due_date,
                created_at: new Date().toISOString()
              })
              .select()
              .single();

            if (deadlineError) {
              console.error('âŒ Error saving deadline:', deadlineError);
              toast({
                title: 'Warning',
                description: 'Task assigned; deadline could not be saved.',
                variant: 'destructive',
              });
            } else {
              logger.debug('âœ… Deadline saved successfully:', deadlineRecord);
            }
          } else {
            logger.debug('âš ï¸ Deadline not saved:', {
              has_due_date: !!data.due_date,
              has_assignment_record: !!assignmentRecord,
              due_date_value: data.due_date
            });
          }
        }
      }

      logger.debug('Task added successfully');
      
      toast({
        title: 'Success',
        description: 'Task added successfully'
      });
      
      // Clear cache for all users and refresh data immediately
      clearCache(`tasks_${organizationId}_*`);
      await fetchTasks(true);
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: 'Error',
        description: 'Failed to add task',
        variant: 'destructive'
      });
    }
  };

  const updateTask = async (id: string, data: Partial<Task>) => {
    // Find the current task to check has_reminder value
    const currentTask = tasks.find(t => t.id === id);
    
    // If status is being set to "completed" and has_reminder is true, set it to false
    if (data.status === 'completed' && currentTask?.has_reminder === true) {
      data.has_reminder = false;
    }
    
    // Note: finish_date is now automatically handled by database trigger
    // When status = 'completed', trigger sets finish_date = NOW()
    // When status != 'completed', trigger sets finish_date = NULL
    // Remove finish_date from data if present, let trigger handle it
    if (data.finish_date !== undefined) {
      delete data.finish_date;
    }
    
    // Extract assigned_to from data (handled via daily_tasks_assigned table)
    const assignedTo = data.assigned_to;
    // Whitelist columns that exist on daily_tasks table to avoid 500 from invalid/relation fields
    const allowedKeys = [
      'title', 'description', 'status', 'priority', 'due_date', 'finish_date',
      'organization_id', 'created_by', 'plan_date', 'objective_id',
      'has_reminder', 'has_steps', 'has_substeps', 'updated_at'
    ] as const;
    const updateData: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in data && (data as any)[key] !== undefined) {
        if (key === 'finish_date') continue; // Let DB trigger handle finish_date
        updateData[key] = (data as any)[key];
      }
    }
    
    // Optimistic update: update local state immediately
    const previousTasks = [...tasks];
    const previousStatus = currentTask?.status;
    const isStatusChanged = data.status !== undefined && data.status !== previousStatus;
    
    setTasks(prevTasks => 
      prevTasks.map(task => {
        if (task.id === id) {
          const updatedTask = { ...task, ...data };
          
          // Optimistic update for finish_date based on status change
          // This provides instant UI feedback while database trigger sets the actual value
          if (isStatusChanged) {
            if (data.status === 'completed') {
              // Set finish_date to current timestamp for optimistic update
              updatedTask.finish_date = new Date().toISOString();
            } else {
              // Clear finish_date if status is not completed
              updatedTask.finish_date = null;
            }
          }
          
          return updatedTask;
        }
        return task;
      })
    );

    try {
      // Update the task (only whitelisted columns); retry once on 500 (transient server error)
      for (let attempt = 0; attempt <= 1; attempt++) {
        const { error } = await supabase
          .from('daily_tasks')
          .update(updateData)
          .eq('id', id);
        if (!error) break;
        const isRetryable = (error as any).status === 500 || (error as any).code === 'PGRST301';
        if (isRetryable && attempt < 1) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        throw error;
      }

      // When assignee marks task completed, create pending approval for assigner only if task has NO steps (per spec: task with steps only need step-level approval)
      const taskHasNoSteps = !currentTask?.steps?.length || currentTask?.has_steps === false;
      if (data.status === 'completed' && organizationId && taskHasNoSteps) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: currentEmp } = await supabase.from('employees').select('id').eq('user_id', user?.id).eq('organization_id', organizationId).maybeSingle();
        const { data: assignment } = await supabase.from('daily_tasks_assigned').select('employee_id, assigned_by').eq('daily_task_id', id).order('assigned_at', { ascending: false }).limit(1).maybeSingle();
        if (currentEmp?.id && assignment && assignment.employee_id === currentEmp.id) {
          await createCompletionApprovalIfAssignee({
            organizationId,
            entityType: 'task',
            dailyTaskId: id,
            assigneeEmployeeId: assignment.employee_id,
            assignerEmployeeId: assignment.assigned_by,
            completedAt: new Date().toISOString(),
          });
        }
      }

      // Handle assignment separately using daily_tasks_assigned table
      if (assignedTo !== undefined) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: assignedBy } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user?.id)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (assignedBy) {
          // Check if assignment already exists
          const { data: existingAssignment } = await supabase
            .from('daily_tasks_assigned')
            .select('id')
            .eq('daily_task_id', id)
            .maybeSingle();

          if (assignedTo) {
            // Update or create assignment
            if (existingAssignment) {
              // Update existing assignment
              const { error: assignmentError } = await supabase
                .from('daily_tasks_assigned')
                .update({
                  employee_id: assignedTo,
                  assigned_by: assignedBy.id,
                  assigned_at: new Date().toISOString()
                })
                .eq('id', existingAssignment.id);

              if (assignmentError) {
                console.error('Error updating assignment:', assignmentError);
              }
            } else {
              // Create new assignment
              const { error: assignmentError } = await supabase
                .from('daily_tasks_assigned')
                .insert({
                  organization_id: organizationId,
                  daily_task_id: id,
                  employee_id: assignedTo,
                  assigned_by: assignedBy.id,
                  assigned_at: new Date().toISOString()
                });

              if (assignmentError) {
                console.error('Error creating assignment:', assignmentError);
              }
            }
          } else {
            // Remove assignment if assignedTo is null/empty
            if (existingAssignment) {
              const { error: assignmentError } = await supabase
                .from('daily_tasks_assigned')
                .delete()
                .eq('id', existingAssignment.id);

              if (assignmentError) {
                console.error('Error deleting assignment:', assignmentError);
              }
            }
          }
        }
      }

      // For status updates (and has_reminder auto-update when completing), fetch finish_date from database
      // Check if update is primarily a status update (has_reminder might be auto-set to false)
      // Also check if assignment changed (assigned_to is handled separately)
      const isStatusUpdate = data.status !== undefined;
      const hasAssignmentChange = assignedTo !== undefined;
      // Note: finish_date is handled by database trigger, not included in updateData
      const hasOnlyStatusOrReminder = Object.keys(updateData).every(key => key === 'status' || key === 'has_reminder');
      
      if (isStatusUpdate && hasOnlyStatusOrReminder && !hasAssignmentChange) {
        // Fetch updated task to get finish_date from database trigger
        // This ensures we get the exact finish_date set by the database trigger
        const { data: updatedTask, error: fetchError } = await supabase
          .from('daily_tasks')
          .select('finish_date, status')
          .eq('id', id)
          .single();

        if (!fetchError && updatedTask) {
          // Update local state with finish_date from database
          // This replaces the optimistic update with the actual value from database
          setTasks(prevTasks => 
            prevTasks.map(task => {
              if (task.id === id) {
                return { 
                  ...task, 
                  finish_date: updatedTask.finish_date,
                  status: updatedTask.status as 'pending' | 'in_progress' | 'completed' | 'cancelled'
                };
              }
              return task;
            })
          );
        }

        // Mark this task as recently updated to skip real-time refresh
        // For tasks without substeps, extend the skip time since they don't have progress-based sync
        const skipDuration = currentTask?.has_substeps === false ? 5000 : 3000;
        recentlyUpdatedTasksRef.current.add(id);
        // Clear after specified duration (enough time for real-time event to arrive)
        setTimeout(() => {
          recentlyUpdatedTasksRef.current.delete(id);
        }, skipDuration);
      } else {
        // Refresh for non-status updates (title, description, priority, assignment changes, etc.)
        clearCache(`tasks_${organizationId}_*`);
        fetchTasks(true).catch(err => console.error('Background refresh failed:', err));
      }
      
      // Don't show toast for status updates to reduce noise
      if (!data.status) {
        toast({
          title: 'Success',
          description: 'Task updated successfully'
        });
      }
    } catch (error) {
      // Rollback on error
      setTasks(previousTasks);
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive'
      });
    }
  };

  const deleteTask = async (id: string) => {
    // Optimistic update: remove task from local state immediately
    const previousTasks = [...tasks];
    setTasks(prevTasks => prevTasks.filter(task => task.id !== id));

    try {
      const { error } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task deleted successfully'
      });
      
      // Clear cache for all users and refresh data in background
      clearCache(`tasks_${organizationId}_*`);
      fetchTasks(true).catch(err => console.error('Background refresh failed:', err));
    } catch (error) {
      // Rollback on error
      setTasks(previousTasks);
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive'
      });
    }
  };

  const addTaskStep = async (taskId: string, title: string, description?: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get current max order for this task
      const { data: existingSteps } = await supabase
        .from('task_steps')
        .select('order')
        .eq('task_id', taskId)
        .order('order', { ascending: false })
        .limit(1);

      const nextOrder = existingSteps && existingSteps.length > 0 
        ? ((existingSteps as any)[0].order as number) + 1 
        : 1;

      const { error } = await supabase
        .from('task_steps')
        .insert({
          task_id: taskId,
          title,
          description: description?.trim() || null,
          is_completed: false,
          order: nextOrder,
          created_by: user?.id || null
        });

      if (error) throw error;

      // Update has_steps to true (optimistic update - trigger will handle it, but we do it for consistency)
      const { error: updateError } = await supabase
        .from('daily_tasks')
        .update({ has_steps: true })
        .eq('id', taskId);
      
      if (updateError) {
        console.warn('Failed to update has_steps:', updateError);
      }

      // Sync status ke pending di background (task punya step baru yang belum selesai). Non-blocking agar loading tetap cepat.
      supabase
        .from('daily_tasks')
        .select('status')
        .eq('id', taskId)
        .single()
        .then(
          ({ data: taskRow }) => {
            if (taskRow?.status === 'completed') {
              void supabase.from('daily_tasks').update({ status: 'pending' }).eq('id', taskId).then(() => {});
            }
          },
          () => {},
        );

      toast({
        title: 'Success',
        description: 'Step added successfully'
      });
      
      clearCache(`tasks_${organizationId}_*`);
      await fetchTasks(true);
    } catch (error) {
      console.error('Error adding step:', error);
      toast({
        title: 'Error',
        description: 'Failed to add step',
        variant: 'destructive'
      });
    }
  };

  const updateTaskStep = async (stepId: string, data: Partial<TaskStep>, options?: { autoReorder?: boolean }) => {
    try {
      // Fetch existing to detect status change - with retry
      const { data: before } = await retryableQuery(async () => {
        const result = await supabase
          .from('task_steps')
          .select('id, is_completed, title, task_id')
          .eq('id', stepId)
          .single();
        if (result.error) throw result.error;
        return result;
      });

      // Prepare update data with completed_at handling
      const updateData: any = { ...data };
      
      // If is_completed is being updated, ensure completed_at is set correctly
      if (typeof updateData.is_completed === 'boolean') {
        if (updateData.is_completed === true) {
          // If marking as completed, set completed_at to NOW() if not already set
          updateData.completed_at = updateData.completed_at || new Date().toISOString();
        } else {
          // If marking as not completed, set completed_at to NULL
          updateData.completed_at = null;
        }
      }

      // Update step - with retry
      const { error } = await retryableQuery(async () => {
        const result = await supabase
          .from('task_steps')
          .update(updateData)
          .eq('id', stepId);
        if (result.error) throw result.error;
        return result;
      });

      if (error) throw error;

      // Get task_id for this step
      const { data: stepData } = await supabase
        .from('task_steps')
        .select('task_id')
        .eq('id', stepId)
        .single();

      const taskId = (stepData as any)?.task_id;

      // Check if completion status changed (before we update anything)
      // Safely check if before exists and if completion status changed
      const beforeCompleted = before ? (before as any).is_completed : false;
      const afterCompleted = typeof updateData.is_completed === 'boolean' ? updateData.is_completed : beforeCompleted;
      const completionChanged = typeof updateData.is_completed === 'boolean' && before && beforeCompleted !== updateData.is_completed;

      // When assignee marks step completed, create pending approval for assigner
      if (afterCompleted && taskId && organizationId) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: currentEmp } = await supabase.from('employees').select('id').eq('user_id', user?.id).eq('organization_id', organizationId).maybeSingle();
        const { data: stepAssignment } = await supabase
          .from('task_steps_assigned')
          .select('employee_id, assigned_by')
          .eq('task_step_id', stepId)
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fallback: if step is not explicitly assigned, use task-level assignment.
        // This matches user expectation: when Octa assigns the task to Milda, completing any step should notify Octa.
        const effectiveAssignment =
          stepAssignment?.employee_id && stepAssignment?.assigned_by
            ? stepAssignment
            : (await supabase
                .from('daily_tasks_assigned')
                .select('employee_id, assigned_by')
                .eq('daily_task_id', taskId)
                .order('assigned_at', { ascending: false })
                .limit(1)
                .maybeSingle()).data;

        if (currentEmp?.id && effectiveAssignment && effectiveAssignment.employee_id === currentEmp.id && effectiveAssignment.assigned_by) {
          const completedAt = (updateData as any).completed_at || new Date().toISOString();
          await createCompletionApprovalIfAssignee({
            organizationId,
            entityType: 'step',
            dailyTaskId: taskId,
            taskStepId: stepId,
            assigneeEmployeeId: effectiveAssignment.employee_id,
            assignerEmployeeId: effectiveAssignment.assigned_by,
            completedAt,
          });
        }
      }

      // Track if we should skip refresh (for mobile auto-reorder)
      let skipRefresh = false;

      if (taskId) {
        // Get all steps for this task
        const { data: allSteps } = await supabase
          .from('task_steps')
          .select('is_completed')
          .eq('task_id', taskId);

        if (allSteps) {
          // Get current task status first (needed for progress calculation if no steps)
          const { data: currentTask } = await supabase
            .from('daily_tasks')
            .select('status')
            .eq('id', taskId)
            .single();
          
          const currentStatus = (currentTask as any)?.status || 'pending';
          
          // Calculate progress and determine new status
          // Pass task status to calculateProgress for tasks without steps
          const progress = calculateProgress(allSteps as any, currentStatus);
          const newStatus = determineStatusFromProgress(progress, 'pending');
          
          const finalStatus = determineStatusFromProgress(progress, currentStatus);
          
          // Update task status based on progress
          // Note: finish_date is now automatically handled by database trigger
          // When status = 'completed', trigger sets finish_date = NOW()
          // When status != 'completed', trigger sets finish_date = NULL
          const updateData: any = { status: finalStatus };
          
          await supabase
            .from('daily_tasks')
            .update(updateData)
            .eq('id', taskId);
        }

        // Auto-reorder steps if completion status changed and autoReorder is enabled
        if (options?.autoReorder && completionChanged && taskId) {
          // Auto-reorder steps and update local state without full reload
          try {
            const reorderResult = await autoReorderTaskSteps(taskId);
            
            if (reorderResult && reorderResult.length > 0) {
              skipRefresh = true; // Mark to skip refresh
              
              // Update local state with new order and step completion without full reload
              setTasks(prevTasks => {
                return prevTasks.map(task => {
                  if (task.id !== taskId) return task;
                  
                  // Create order mapping
                  const orderMap = new Map<string, number>();
                  reorderResult.forEach(r => {
                    orderMap.set(r.stepId, r.newOrder);
                  });
                  
                  // Update steps with new order, completion status, and sort
                  const updatedSteps = task.steps
                    .map(step => {
                      const newOrder = orderMap.get(step.id);
                      if (step.id === stepId) {
                        // Update the toggled step's completion status
                        return {
                          ...step,
                          order: newOrder !== undefined ? newOrder : step.order,
                          is_completed: afterCompleted,
                          updated_at: new Date().toISOString()
                        };
                      }
                      // Update order for other steps
                      return {
                        ...step,
                        order: newOrder !== undefined ? newOrder : step.order
                      };
                    })
                    .sort((a, b) => a.order - b.order);
                  
                  // Recalculate progress
                  // Pass task status to calculateProgress for tasks without steps
                  const progress = calculateProgress(updatedSteps, task.status);
                  
                  return {
                    ...task,
                    steps: updatedSteps,
                    progress_percentage: progress,
                    status: determineStatusFromProgress(progress, task.status) as any
                  };
                });
              });
              
              // Clear cache but don't refresh - we already updated local state
              clearCache(`tasks_${organizationId}_*`);
              
              // Record history if completion status changed (async, don't wait)
              if (completionChanged) {
                supabase.auth.getUser().then(({ data: { user } }) => {
                  (supabase as any)
                    .from('task_step_history')
                    .insert({
                      task_step_id: stepId,
                      action_type: 'status_change',
                      old_value: beforeCompleted ? 'completed' : 'pending',
                      new_value: afterCompleted ? 'completed' : 'pending',
                      description: afterCompleted ? 'Step completed' : 'Step reopened',
                      created_by: user?.id || null,
                    });
                }).catch(err => console.error('Error recording history:', err));
              }
            }
          } catch (error) {
            console.error('Error auto-reordering steps:', error);
            // Don't throw - continue with normal flow even if reorder fails
          }
        }
      }
        
      // Record history if completion status changed (only if auto-reorder didn't handle it)
      if (completionChanged && !skipRefresh) {
        const { data: { user } } = await supabase.auth.getUser();
        await (supabase as any)
          .from('task_step_history')
          .insert({
            task_step_id: stepId,
            action_type: 'status_change',
            old_value: beforeCompleted ? 'completed' : 'pending',
            new_value: afterCompleted ? 'completed' : 'pending',
            description: afterCompleted ? 'Step completed' : 'Step reopened',
            created_by: user?.id || null,
          });
      }

      // Don't show toast notification - this is an internal update function
      // Toast notifications should only appear for explicit user actions
      // If toast is needed, it should be shown at the call site for user-initiated actions
      
      // Only refresh if we didn't skip it (for mobile auto-reorder)
      // For mobile with auto-reorder, we skip fetchTasks to avoid reload that confuses users
      if (!skipRefresh) {
        // Normal update flow - clear cache and refresh
        clearCache(`tasks_${organizationId}_*`);
        await fetchTasks(true);
      }
      // If skipRefresh is true, we've already updated local state above, so skip fetchTasks
    } catch (error: any) {
      console.error('Error updating step:', error);
      
      // Check if it's a network error
      const isNetworkError = error?.message?.includes('Network') || 
                            error?.message?.includes('timeout') ||
                            error?.message?.includes('CORS') ||
                            error?.message?.includes('520');
      
      toast({
        title: isNetworkError ? 'Network Error' : 'Error',
        description: isNetworkError 
          ? 'Connection issue. Please check your internet and try again.' 
          : 'Failed to update step',
        variant: 'destructive'
      });
    }
  };

  const assignTaskStep = async (stepId: string, employeeId: string | null, dueDateIso?: string | null) => {
    try {
      logger.debug('ðŸŽ¯ Assigning step:', { stepId, employeeId, dueDateIso });
      
      // Get current user to set assigned_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const { data: currentEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      logger.userData('ðŸ‘¤ Current employee ID:', currentEmployee?.id);

      // If assigning (not unassigning), we need assigned_by to be set
      if (employeeId && !currentEmployee?.id) {
        throw new Error('Current employee not found. Cannot assign step without assigned_by.');
      }

      if (employeeId) {
        // delete any existing assignment rows (we only keep latest)
        await supabase
          .from('task_steps_assigned')
          .delete()
          .eq('task_step_id', stepId);

        // insert new assignment
        // fetch organization id via step -> task, and get social_media_plan_id
        const { data: stepTask } = await supabase
          .from('task_steps')
          .select('task_id, social_media_plan_id')
          .eq('id', stepId)
          .single();
        const { data: taskOrg } = await supabase
          .from('daily_tasks')
          .select('organization_id')
          .eq('id', (stepTask as any)?.task_id)
          .single();

        const { data: inserted, error } = await supabase
          .from('task_steps_assigned')
          .insert({
            organization_id: (taskOrg as any)?.organization_id || null,
            task_step_id: stepId,
            employee_id: employeeId,
            assigned_by: currentEmployee!.id, // Validated above - must exist when assigning
            assigned_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (error) throw error;

        logger.debug('âœ… Step assigned successfully. Assignment ID:', (inserted as any)?.id);

        // Save due date if provided
        if (dueDateIso) {
          const { data: dueDateRecord, error: dueDateError } = await supabase
            .from('task_steps_assigned_duedate')
            .insert({
              organization_id: (taskOrg as any)?.organization_id || null,
              task_steps_assigned_id: (inserted as any).id,
              due_date: dueDateIso,
            })
            .select()
            .single();
          
          if (dueDateError) {
            console.error('âŒ Error saving due date:', dueDateError);
          } else {
            logger.debug('âœ… Due date saved:', dueDateRecord);
          }
        }

        // Sync pic_production_id to social_media_plans if this step is linked to a plan
        if ((stepTask as any)?.social_media_plan_id) {
          try {
            const planId = (stepTask as any).social_media_plan_id;
            // Get current plan data
            const { data: planData } = await supabase
              .from('social_media_plans')
              .select('pic_production_id, pic_production_source, google_drive_link')
              .eq('id', planId)
              .maybeSingle();
            
            if (planData) {
              // Import and use syncPicProduction function
              // We'll use a direct implementation here to avoid circular dependencies
              // Get latest assignment for this plan
              const { data: assignmentData } = await supabase
                .from('task_steps_assigned')
                .select(`
                  id,
                  employee_id,
                  assigned_at,
                  task_steps!inner(
                    id,
                    social_media_plan_id
                  )
                `)
                .eq('task_steps.social_media_plan_id', planId)
                .order('assigned_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              const assignedEmployeeId = assignmentData?.employee_id || null;
              
              // Determine new pic_production_id and source
              let newPicProductionId: string | null = null;
              let newPicProductionSource: string | null = null;
              
              if (assignedEmployeeId) {
                newPicProductionId = assignedEmployeeId;
                newPicProductionSource = 'task_steps_assigned';
              } else if (planData.google_drive_link) {
                if (planData.pic_production_source === 'google_drive_link' && planData.pic_production_id) {
                  newPicProductionId = planData.pic_production_id;
                  newPicProductionSource = 'google_drive_link';
                } else {
                  newPicProductionId = null;
                  newPicProductionSource = null;
                }
              } else {
                newPicProductionId = null;
                newPicProductionSource = null;
              }
              
              // Update database only if changed
              if (newPicProductionId !== planData.pic_production_id || newPicProductionSource !== planData.pic_production_source) {
                const { error: updateError } = await supabase
                  .from('social_media_plans')
                  .update({
                    pic_production_id: newPicProductionId,
                    pic_production_source: newPicProductionSource
                  })
                  .eq('id', planId);
                
                if (updateError) {
                  console.error('âŒ Error syncing pic_production_id:', updateError);
                } else {
                  logger.debug('âœ… Synced pic_production_id after assignment:', {
                    planId,
                    employeeId: newPicProductionId,
                    source: newPicProductionSource
                  });
                }
              }
            }
          } catch (syncError) {
            console.error('Error syncing pic_production_id in assignTaskStep:', syncError);
            // Don't fail the whole operation if sync fails
          }
        }
      } else {
        // unassign by deleting assignment rows for this step
        logger.debug('ðŸ”“ Unassigning step:', stepId);
        
        // Get social_media_plan_id before deleting assignment
        const { data: stepData } = await supabase
          .from('task_steps')
          .select('social_media_plan_id')
          .eq('id', stepId)
          .maybeSingle();
        
        const { error } = await supabase
          .from('task_steps_assigned')
          .delete()
          .eq('task_step_id', stepId);
        if (error) throw error;
        logger.debug('âœ… Step unassigned successfully');

        // Sync pic_production_id after unassignment if this step was linked to a plan
        if ((stepData as any)?.social_media_plan_id) {
          try {
            const planId = (stepData as any).social_media_plan_id;
            // Get current plan data
            const { data: planData } = await supabase
              .from('social_media_plans')
              .select('pic_production_id, pic_production_source, google_drive_link')
              .eq('id', planId)
              .maybeSingle();
            
            if (planData) {
              // Get latest assignment for this plan (after deletion)
              const { data: assignmentData } = await supabase
                .from('task_steps_assigned')
                .select(`
                  id,
                  employee_id,
                  assigned_at,
                  task_steps!inner(
                    id,
                    social_media_plan_id
                  )
                `)
                .eq('task_steps.social_media_plan_id', planId)
                .order('assigned_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              const assignedEmployeeId = assignmentData?.employee_id || null;
              
              // Determine new pic_production_id and source
              let newPicProductionId: string | null = null;
              let newPicProductionSource: string | null = null;
              
              if (assignedEmployeeId) {
                newPicProductionId = assignedEmployeeId;
                newPicProductionSource = 'task_steps_assigned';
              } else if (planData.google_drive_link) {
                if (planData.pic_production_source === 'google_drive_link' && planData.pic_production_id) {
                  newPicProductionId = planData.pic_production_id;
                  newPicProductionSource = 'google_drive_link';
                } else {
                  newPicProductionId = null;
                  newPicProductionSource = null;
                }
              } else {
                newPicProductionId = null;
                newPicProductionSource = null;
              }
              
              // Update database only if changed
              if (newPicProductionId !== planData.pic_production_id || newPicProductionSource !== planData.pic_production_source) {
                const { error: updateError } = await supabase
                  .from('social_media_plans')
                  .update({
                    pic_production_id: newPicProductionId,
                    pic_production_source: newPicProductionSource
                  })
                  .eq('id', planId);
                
                if (updateError) {
                  console.error('âŒ Error syncing pic_production_id after unassignment:', updateError);
                } else {
                  logger.debug('âœ… Synced pic_production_id after unassignment:', {
                    planId,
                    employeeId: newPicProductionId,
                    source: newPicProductionSource
                  });
                }
              }
            }
          } catch (syncError) {
            console.error('Error syncing pic_production_id after unassignment:', syncError);
            // Don't fail the whole operation if sync fails
          }
        }
      }

      toast({
        title: 'Success',
        description: employeeId ? 'Step assigned successfully' : 'Step unassigned successfully'
      });
      
      logger.debug('ðŸ”„ Refreshing tasks...');
      clearCache(`tasks_${organizationId}_*`);
      await fetchTasks(true);
      logger.debug('âœ… Tasks refreshed');
    } catch (error) {
      console.error('Error assigning step:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign step',
        variant: 'destructive'
      });
    }
  };

  const deleteTaskStep = async (stepId: string) => {
    // Get task_id and social_media_plan_id before deleting (needed for sync logic)
    const { data: stepData } = await supabase
      .from('task_steps')
      .select('task_id, social_media_plan_id')
      .eq('id', stepId)
      .maybeSingle();

    // Optimistic update: remove step from local state immediately
    const previousTasks = [...tasks];
    setTasks(prevTasks =>
      prevTasks.map(task => {
        const filteredSteps = task.steps.filter(step => step.id !== stepId);
        const isUpdatedTask = stepData?.task_id === task.id;
        const progress = isUpdatedTask
          ? calculateProgress(filteredSteps as any, task.status)
          : task.progress_percentage;
        const nextStatus = isUpdatedTask
          ? determineStatusFromProgress(progress, task.status)
          : task.status;
        return {
          ...task,
          steps: filteredSteps,
          progress_percentage: progress,
          status: nextStatus as Task['status'],
          // Update has_steps if this task had the step removed
          has_steps: isUpdatedTask ? filteredSteps.length > 0 : task.has_steps,
          has_substeps: isUpdatedTask ? filteredSteps.length > 0 : task.has_substeps,
        };
      })
    );

    try {
      // Delete step with timeout handling
      const { error } = await supabase
        .from('task_steps')
        .delete()
        .eq('id', stepId);

      if (error) {
        // Check if it's a timeout error
        if (error.code === '57014' || error.message?.includes('timeout')) {
          // For timeout errors, still show success but note it may take time
          toast({
            title: 'Deleting step...',
            description: 'Step deletion is in progress. It may take a moment to complete.',
          });
          
          // Continue with background operations even on timeout
          // The database will eventually complete the deletion
        } else {
          throw error;
        }
      } else {
        toast({
          title: 'Success',
          description: 'Step deleted successfully'
        });
      }

      // Move heavy operations to background (non-blocking)
      // Sync pic_production_id after step deletion if this step was linked to a plan
      if ((stepData as any)?.social_media_plan_id) {
        // Run in background without blocking
        (async () => {
          try {
            const planId = (stepData as any).social_media_plan_id;
            // Get current plan data
            const { data: planData } = await supabase
              .from('social_media_plans')
              .select('pic_production_id, pic_production_source, google_drive_link')
              .eq('id', planId)
              .maybeSingle();
            
            if (planData) {
              // Get latest assignment for this plan (after step deletion)
              const { data: assignmentData } = await supabase
                .from('task_steps_assigned')
                .select(`
                  id,
                  employee_id,
                  assigned_at,
                  task_steps!inner(
                    id,
                    social_media_plan_id
                  )
                `)
                .eq('task_steps.social_media_plan_id', planId)
                .order('assigned_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              const assignedEmployeeId = assignmentData?.employee_id || null;
              
              // Determine new pic_production_id and source
              let newPicProductionId: string | null = null;
              let newPicProductionSource: string | null = null;
              
              if (assignedEmployeeId) {
                newPicProductionId = assignedEmployeeId;
                newPicProductionSource = 'task_steps_assigned';
              } else if (planData.google_drive_link) {
                if (planData.pic_production_source === 'google_drive_link' && planData.pic_production_id) {
                  newPicProductionId = planData.pic_production_id;
                  newPicProductionSource = 'google_drive_link';
                } else {
                  newPicProductionId = null;
                  newPicProductionSource = null;
                }
              } else {
                newPicProductionId = null;
                newPicProductionSource = null;
              }
              
              // Update database only if changed
              if (newPicProductionId !== planData.pic_production_id || newPicProductionSource !== planData.pic_production_source) {
                const { error: updateError } = await supabase
                  .from('social_media_plans')
                  .update({
                    pic_production_id: newPicProductionId,
                    pic_production_source: newPicProductionSource
                  })
                  .eq('id', planId);
                
                if (updateError) {
                  console.error('âŒ Error syncing pic_production_id after step deletion:', updateError);
                } else {
                  logger.debug('âœ… Synced pic_production_id after step deletion:', {
                    planId,
                    employeeId: newPicProductionId,
                    source: newPicProductionSource
                  });
                }
              }
            }
          } catch (syncError) {
            console.error('Error syncing pic_production_id after step deletion:', syncError);
            // Don't fail the whole operation if sync fails
          }
        })().catch(err => console.error('Background sync failed:', err));
      }

      // Check if task still has steps after deletion (run in background)
      if (stepData?.task_id) {
        // Run in background without blocking
        (async () => {
          try {
            const { data: remainingSteps } = await supabase
              .from('task_steps')
              .select('id')
              .eq('task_id', stepData.task_id)
              .limit(1);

            const { error: updateError } = await supabase
              .from('daily_tasks')
              .update({ has_steps: (remainingSteps?.length || 0) > 0 })
              .eq('id', stepData.task_id);
            
            if (updateError) {
              console.warn('Failed to update has_steps:', updateError);
            }
          } catch (err) {
            console.error('Error updating has_steps:', err);
          }
        })().catch(err => console.error('Background has_steps update failed:', err));
      }

      // Clear cache and refresh in background
      clearCache(`tasks_${organizationId}_*`);
      fetchTasks(true).catch(err => console.error('Background refresh failed:', err));
    } catch (error: any) {
      // Rollback on error (only for non-timeout errors)
      if (error.code !== '57014' && !error.message?.includes('timeout')) {
        setTasks(previousTasks);
        console.error('Error deleting step:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete step',
          variant: 'destructive'
        });
      } else {
        // For timeout, don't rollback - let it complete in background
        console.warn('Step deletion timed out, but will complete in background:', error);
      }
    }
  };

  const reorderTaskSteps = async (taskId: string, stepIds: string[]) => {
    let previousTasks: Task[] | null = null;
    try {
      // Optimistic update: reorder steps in memory so UI updates immediately (no snap-back)
      setTasks((prevTasks) => {
        previousTasks = prevTasks;
        const taskIndex = prevTasks.findIndex((t) => t.id === taskId);
        if (taskIndex === -1) return prevTasks;
        const task = prevTasks[taskIndex];
        const steps = task.steps ?? [];
        const stepMap = new Map(steps.map((s) => [s.id, s]));
        const reorderedSteps = stepIds
          .map((id, index) => {
            const step = stepMap.get(id);
            if (!step) return null;
            return { ...step, order: index + 1 };
          })
          .filter((s): s is TaskStep => s != null);
        if (reorderedSteps.length !== steps.length) return prevTasks;
        const next = [...prevTasks];
        next[taskIndex] = { ...task, steps: reorderedSteps };
        return next;
      });

      // Persist to Supabase in background (no refetch on success to avoid reload/snap-back)
      const updatePromises = stepIds.map((stepId, index) =>
        supabase
          .from('task_steps')
          .update({ order: index + 1 })
          .eq('id', stepId)
      );

      await Promise.all(updatePromises);

      clearCache(`tasks_${organizationId}_*`);
      toast({
        title: 'Success',
        description: 'Steps reordered successfully',
      });
    } catch (error) {
      console.error('Error reordering steps:', error);
      if (previousTasks != null) {
        setTasks(previousTasks);
      }
      toast({
        title: 'Error',
        description: 'Failed to reorder steps',
        variant: 'destructive',
      });
    }
  };

  const uploadTaskFile = async (taskId: string, file: File) => {
    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `task-files/${taskId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-files')
        .getPublicUrl(filePath);

      // Get the first task step for this task
      const { data: taskSteps } = await supabase
        .from('task_steps')
        .select('id')
        .eq('task_id', taskId)
        .order('order', { ascending: true })
        .limit(1);

      if (!taskSteps || taskSteps.length === 0) {
        throw new Error('No task steps found for this task');
      }

      // Save file record to database
      const { error: dbError } = await supabase
        .from('task_files')
        .insert({
          task_steps_id: (taskSteps as any)[0].id,
          filename: file.name,
          file_url: publicUrl,
          file_size: file.size
        });

      if (dbError) throw dbError;

      toast({
        title: 'Success',
        description: 'File uploaded successfully'
      });
      
      clearCache(`tasks_${organizationId}`);
      await fetchTasks(true);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive'
      });
    }
  };

  const uploadTaskStepFile = async (taskStepId: string, file: File) => {
    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `task-step-files/${taskStepId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-files')
        .getPublicUrl(filePath);

      // Save file record to database
      const { error: dbError } = await supabase
        .from('task_files')
        .insert({
          task_steps_id: taskStepId,
          filename: file.name,
          file_url: publicUrl,
          file_size: file.size
        });

      if (dbError) throw dbError;

      toast({
        title: 'Success',
        description: 'File uploaded successfully'
      });
      
      clearCache(`tasks_${organizationId}_*`);
      await fetchTasks(true);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive'
      });
    }
  };

  const deleteTaskFile = async (fileId: string) => {
    try {
      // First get the file record to get the file path
      const { data: fileRecord, error: fetchError } = await supabase
        .from('task_files')
        .select('file_url')
        .eq('id', fileId)
        .single();

      if (fetchError) throw fetchError;

      // Extract file path from URL
      const fileUrl = (fileRecord as any).file_url;
      const urlParts = fileUrl.split('/');
      const bucketName = urlParts[urlParts.length - 3]; // task-files
      const filePath = urlParts.slice(urlParts.length - 2).join('/'); // task-step-files/stepId/filename

      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('task-files')
        .remove([filePath]);

      if (storageError) {
        console.warn('Error deleting file from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete record from database
      const { error: dbError } = await supabase
        .from('task_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      toast({
        title: 'Success',
        description: 'File deleted successfully'
      });
      
      clearCache(`tasks_${organizationId}_*`);
      await fetchTasks(true);
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive'
      });
    }
  };

  const calculateTaskProgress = (taskId: string): number => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return 0;
    // Pass task status to calculateProgress for tasks without steps
    return calculateProgress(task.steps, task.status);
  };

  // Deadline extension functions
  const requestDeadlineExtension = async (taskId: string, newDeadline: string, reason: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be signed in to perform this action.',
          variant: 'destructive',
        });
        return;
      }

      const task = tasks.find(t => t.id === taskId);
      if (!task || !task.due_date) {
        throw new Error('Task or due date not found');
      }

      const { error } = await supabase
        .from('deadline_history')
        .insert({
          task_id: taskId,
          original_deadline: task.due_date,
          new_deadline: newDeadline,
          reason: reason,
          requested_by: user.id
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Deadline extension request submitted'
      });
      
      clearCache(`tasks_${organizationId}_*`);
      await fetchTasks(true);
    } catch (error) {
      console.error('Error requesting deadline extension:', error);
      toast({
        title: 'Error',
        description: 'Failed to request deadline extension',
        variant: 'destructive'
      });
    }
  };

  const approveDeadlineExtension = async (historyId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be signed in to perform this action.',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('deadline_history')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', historyId);

      if (error) throw error;

      // Update the task's due_date to the new deadline
      const { data: historyData } = await supabase
        .from('deadline_history')
        .select('task_id, new_deadline')
        .eq('id', historyId)
        .single();

      if (historyData) {
        await supabase
          .from('daily_tasks')
          .update({ due_date: (historyData as any).new_deadline })
          .eq('id', (historyData as any).task_id);
      }

      toast({
        title: 'Success',
        description: 'Deadline extension approved'
      });
      
      clearCache(`tasks_${organizationId}_*`);
      await fetchTasks(true);
    } catch (error) {
      console.error('Error approving deadline extension:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve deadline extension',
        variant: 'destructive'
      });
    }
  };

  const rejectDeadlineExtension = async (historyId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be signed in to perform this action.',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('deadline_history')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', historyId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Deadline extension rejected'
      });
      
      clearCache(`tasks_${organizationId}_*`);
      await fetchTasks(true);
    } catch (error) {
      console.error('Error rejecting deadline extension:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject deadline extension',
        variant: 'destructive'
      });
    }
  };

  const fetchRejectedReasons = useCallback(async () => {
    if (!organizationId || !currentEmployee?.id) {
      setRejectedReasonsByTaskId({});
      setRejectedReasonsByStepId({});
      setRejectedReasonsBySubStepId({});
      return;
    }
    const { data } = await fetchRejectedForAssignee(organizationId, currentEmployee.id);
    const byTask: Record<string, string> = {};
    const byStep: Record<string, string> = {};
    const bySub: Record<string, string> = {};
    (data ?? []).forEach((row) => {
      if (!row.reject_reason) return;
      if (isStaleLinkRemovalRejection(row)) return;
      if (row.entity_type === 'task' && !(row.daily_task_id in byTask)) byTask[row.daily_task_id] = row.reject_reason;
      if (row.entity_type === 'step' && row.task_step_id && !(row.task_step_id in byStep)) byStep[row.task_step_id] = row.reject_reason;
      if (row.entity_type === 'substep' && row.task_steps_to_steps_id && !(row.task_steps_to_steps_id in bySub)) bySub[row.task_steps_to_steps_id] = row.reject_reason;
    });
    setRejectedReasonsByTaskId(byTask);
    setRejectedReasonsByStepId(byStep);
    setRejectedReasonsBySubStepId(bySub);
  }, [organizationId, currentEmployee?.id]);

  useEffect(() => {
    fetchRejectedReasons();
  }, [fetchRejectedReasons]);

  // Real-time subscriptions using custom hook
  // Create a stable refresh callback that calls fetchTasks
  const handleRefresh = useCallback(() => {
    if (organizationId) {
      // fetchTasks is defined in component scope and uses organizationId from closure
      fetchTasks(true);
    }
  }, [organizationId]);

  useTaskRealtime({
    organizationId,
    onRefresh: handleRefresh,
    recentlyUpdatedTasksRef,
  });

  // Initial data fetch - optimized for fast page load
  useEffect(() => {
    if (!organizationId) return;

    let cancelled = false;

    const loadData = async () => {
      // Non-blocking cache check in background
      (async () => {
        try {
          const getUserPromise = supabase.auth.getUser();
          const getUserTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('getUser timeout')), 2000)
          );
          const result = await Promise.race([getUserPromise, getUserTimeout]);
          const user = (result as any)?.data?.user;
          if (user && !cancelled) {
            const cacheKey = `tasks_${organizationId}_${user.id}`;
            const cached = getCached<any[]>(cacheKey, 60000);
            if (cached !== undefined && cached !== null && !cancelled) {
              setTasks(cached);
            }
          }
        } catch {
          // Ignore - continue without cache
        }
      })();

      fetchTasks().catch((err) => {
        logger.warn('Initial fetchTasks failed', err);
      });
    };

    // Skip duplicate run from React Strict Mode (double-mount in dev).
    // When we skip, still run loadData() so the current mount gets data (avoids empty screen after nav from Initiative etc).
    const now = Date.now();
    if (
      initialLoadState &&
      initialLoadState.orgId === organizationId &&
      now - initialLoadState.at < INITIAL_LOAD_DEDUPE_MS
    ) {
      if (import.meta.env.DEV) {
        logger.debug('â­ï¸ Skipping duplicate daily-task load for org:', organizationId);
      }
      loadData();
      return () => {
        cancelled = true;
      };
    }
    initialLoadState = { orgId: organizationId, at: now };

    loadData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // Apply filters when recentStepFilters or recentStepUpdates change
  useEffect(() => {
    setFilteredRecentStepUpdates(filterRecentStepUpdates(recentStepUpdates, recentStepFilters));
  }, [recentStepFilters, recentStepUpdates]);

  // Navigation function to expand specific task and optionally highlight a step
  const navigateToTask = (taskId: string, stepId?: string) => {
    // Expand the task
    setExpandedTasks(prev => new Set([...prev, taskId]));
    
    // Highlight the task
    setHighlightedTask(taskId);
    
    // Auto-clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedTask(null);
    }, 3000);
    
    // If stepId is provided, set search filter to highlight the step
    if (stepId) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const step = task.steps?.find(s => s.id === stepId);
        if (step) {
          setFilters(prev => ({
            ...prev,
            search: step.title
          }));
          
          // Scroll to specific step after a delay
          setTimeout(() => {
            scrollToStep(stepId);
          }, 200);
        }
      }
    }
  };

  // Function to scroll to specific step
  const scrollToStep = (stepId: string) => {
    const stepElement = document.querySelector(`[data-step-id="${stepId}"]`);
    if (stepElement) {
      stepElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  };

  /** Optimistic update: uncheck task/step/substep in local state (e.g. after reject in pending approval). */
  const uncheckCompletionLocally = useCallback(
    (params: {
      entityType: 'task' | 'step' | 'substep';
      dailyTaskId: string;
      taskStepId?: string | null;
      taskStepsToStepsId?: string | null;
    }) => {
      const { entityType, dailyTaskId, taskStepId, taskStepsToStepsId } = params;
      setTasks((prev) => {
        if (entityType === 'task') {
          return prev.map((t) =>
            t.id === dailyTaskId ? { ...t, status: 'pending' as const } : t
          );
        }
        if (entityType === 'step' && taskStepId) {
          return prev.map((t) =>
            t.id !== dailyTaskId
              ? t
              : {
                  ...t,
                  steps: t.steps.map((s) =>
                    s.id !== taskStepId
                      ? s
                      : { ...s, is_completed: false, completed_at: null }
                  ),
                }
          );
        }
        if (entityType === 'substep' && taskStepId && taskStepsToStepsId) {
          return prev.map((t) =>
            t.id !== dailyTaskId
              ? t
              : {
                  ...t,
                  steps: t.steps.map((s) =>
                    s.id !== taskStepId
                      ? s
                      : {
                          ...s,
                          sub_steps: (s.sub_steps ?? []).map((sub) =>
                            sub.id !== taskStepsToStepsId
                              ? sub
                              : { ...sub, is_completed: false }
                          ),
                        }
                  ),
                }
          );
        }
        return prev;
      });
    },
    []
  );

  const applyApprovalDecisionLocally = useCallback(
    (params: {
      entityType: 'task' | 'step' | 'substep';
      dailyTaskId: string;
      decision: 'approve' | 'reject' | 'unapprove';
      taskStepId?: string | null;
      taskStepsToStepsId?: string | null;
    }) => {
      const { entityType, dailyTaskId, decision, taskStepId, taskStepsToStepsId } = params;
      const shouldComplete = decision === 'approve';
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== dailyTaskId) return task;
          if (entityType === 'task') {
            return { ...task, status: shouldComplete ? 'completed' : 'pending' };
          }
          if (entityType === 'step' && taskStepId) {
            const nextSteps = task.steps.map((s) =>
              s.id !== taskStepId
                ? s
                : {
                    ...s,
                    is_completed: shouldComplete,
                    completed_at: shouldComplete ? new Date().toISOString() : null,
                  }
            );
            const nextProgress = calculateProgress(nextSteps, task.status);
            return {
              ...task,
              steps: nextSteps,
              progress_percentage: nextProgress,
              status: determineStatusFromProgress(nextProgress, task.status) as Task['status'],
            };
          }
          if (entityType === 'substep' && taskStepId && taskStepsToStepsId) {
            const nextSteps = task.steps.map((s) =>
              s.id !== taskStepId
                ? s
                : {
                    ...s,
                    sub_steps: (s.sub_steps ?? []).map((sub) =>
                      sub.id !== taskStepsToStepsId ? sub : { ...sub, is_completed: shouldComplete }
                    ),
                  }
            );
            const nextProgress = calculateProgress(nextSteps, task.status);
            return {
              ...task,
              steps: nextSteps,
              progress_percentage: nextProgress,
              status: determineStatusFromProgress(nextProgress, task.status) as Task['status'],
            };
          }
          return task;
        })
      );
    },
    []
  );

  // Lazy load task_files for one task when user expands it (reduces API calls on page load)
  const fetchTaskFilesForTask = useCallback(async (taskId: string) => {
    if (taskIdsWithFilesLoadedRef.current.has(taskId)) return;
    const task = tasks.find(t => t.id === taskId);
    const stepIds = task?.steps?.map((s: any) => s.id) ?? [];
    if (stepIds.length === 0) {
      taskIdsWithFilesLoadedRef.current.add(taskId);
      return;
    }
    try {
      const { data: files, error } = await supabase
        .from('task_files')
        .select('id, task_steps_id, filename, file_url, file_size, created_at')
        .in('task_steps_id', stepIds)
        .order('created_at', { ascending: false });
      if (error || !files?.length) {
        taskIdsWithFilesLoadedRef.current.add(taskId);
        if (error && import.meta.env.DEV) logger.query('âš ï¸ task_files fetch (lazy):', error.message);
        return;
      }
      const filesByStepId: Record<string, any[]> = {};
      files.forEach((file: any) => {
        if (!filesByStepId[file.task_steps_id]) filesByStepId[file.task_steps_id] = [];
        filesByStepId[file.task_steps_id].push(file);
      });
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? {
                ...t,
                steps: t.steps.map(step => ({
                  ...step,
                  files: filesByStepId[step.id] || step.files || []
                }))
              }
            : t
        )
      );
      taskIdsWithFilesLoadedRef.current.add(taskId);
    } catch {
      taskIdsWithFilesLoadedRef.current.add(taskId);
    }
  }, [tasks]);

  // When user expands a task, lazy-load its files (one request per expanded task)
  useEffect(() => {
    if (tasks.length === 0) return;
    expandedTasks.forEach(taskId => {
      fetchTaskFilesForTask(taskId);
    });
  }, [expandedTasks, tasks.length, fetchTaskFilesForTask]);

  const value: DailyTaskContextType = {
    tasks,
    filteredTasks,
    getVisibleSteps,
    summaryData,
    recentStepUpdates,
    filteredRecentStepUpdates,
    recentStepFilters,
    filters,
    isLoading,
    expandedTasks,
    setExpandedTasks,
    highlightedTask,
    setHighlightedTask,
    setFilters,
    resetFilters,
    setRecentStepFilters,
    addTask,
    updateTask,
    deleteTask,
    addTaskStep,
    updateTaskStep,
    deleteTaskStep,
    assignTaskStep,
    reorderTaskSteps,
    uploadTaskFile,
    uploadTaskStepFile,
    deleteTaskFile,
    calculateTaskProgress,
    requestDeadlineExtension,
    approveDeadlineExtension,
    rejectDeadlineExtension,
    navigateToTask,
    scrollToStep,
    refetchTasks: async () => {
      setPendingApprovalFocus(null);
      clearCache(`tasks_${organizationId}_*`);
      await fetchTasks(true);
      await fetchRejectedReasons();
    },
    uncheckCompletionLocally,
    applyApprovalDecisionLocally,
    rejectedReasonsByTaskId,
    rejectedReasonsByStepId,
    rejectedReasonsBySubStepId,
    pendingApprovalFocus,
    setPendingApprovalFocus,
    highlightFromPendingApproval,
    effectiveFilteredTasks,
    getVisibleStepsEffective,
    fetchRecentStepUpdates,
    departmentMap,
  };

  return (
    <DailyTaskContext.Provider value={value}>
      {children}
    </DailyTaskContext.Provider>
  );
};

