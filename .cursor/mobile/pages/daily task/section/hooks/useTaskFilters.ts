import { useMemo, useCallback } from 'react';
import type { Task, TaskStep as TaskStepEntity } from '@/features/8-2-DailyTask/DailyTaskContext';

interface TaskFilters {
  myTask?: string;
  search?: string;
  status?: string;
  priority?: string;
  pic?: string;
  dateRange?: string;
  customStartDate?: string;
  customEndDate?: string;
}

interface UseTaskFiltersProps {
  tasks: Task[];
  filters: TaskFilters;
  currentUserId?: string;
  currentEmployeeId?: string;
}

/**
 * Custom hook for filtering tasks based on various criteria
 */
export const useTaskFilters = ({
  tasks,
  filters,
  currentUserId,
  currentEmployeeId,
}: UseTaskFiltersProps) => {
  const isMyTask = useCallback(
    (task: Task): boolean => {
      if (!currentUserId && !currentEmployeeId) return false;
      if (task.created_by === currentUserId) return true;
      if (task.assigned_to === currentEmployeeId) return true;

      return (
        task.steps?.some(
          (step) =>
            step.assigned_to === currentEmployeeId ||
            step.sub_steps?.some((subStep) => subStep.assigned_to === currentEmployeeId)
        ) || false
      );
    },
    [currentEmployeeId, currentUserId]
  );

  const hasStepAssignedToPic = useCallback((task: Task, picId: string): boolean => {
    return task.steps?.some((step) => step.assigned_employee?.id === picId) || false;
  }, []);

  const matchesSearch = useCallback((task: Task, searchTerm: string): boolean => {
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    const titleMatch = task.title?.toLowerCase().includes(lower) || false;
    const descMatch = task.description?.toLowerCase().includes(lower) || false;
    const stepMatch =
      task.steps?.some((step) => step.title?.toLowerCase().includes(lower)) || false;
    return titleMatch || descMatch || stepMatch;
  }, []);

  const matchesDateRange = useCallback(
    (task: Task): boolean => {
      if (!filters.dateRange || filters.dateRange === 'all') {
        return true;
      }

      if (!task.due_date) {
        return false;
      }

      const taskDueDate = new Date(task.due_date);
      const now = new Date();

      switch (filters.dateRange) {
        case 'today': {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return taskDueDate >= today && taskDueDate < tomorrow;
        }
        case 'yesterday': {
          const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return taskDueDate >= yesterday && taskDueDate < today;
        }
        case 'this_week': {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 7);
          return taskDueDate >= weekStart && taskDueDate < weekEnd;
        }
        case 'this_month': {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          return taskDueDate >= monthStart && taskDueDate < monthEnd;
        }
        case 'last_month': {
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
          return taskDueDate >= lastMonthStart && taskDueDate < lastMonthEnd;
        }
        case 'custom': {
          if (filters.customStartDate && filters.customEndDate) {
            const startDate = new Date(filters.customStartDate);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(filters.customEndDate);
            endDate.setHours(23, 59, 59, 999);
            return taskDueDate >= startDate && taskDueDate <= endDate;
          }
          return true;
        }
        default:
          return true;
      }
    },
    [filters.customEndDate, filters.customStartDate, filters.dateRange]
  );

  const filteredTasks = useMemo<Task[]>(() => {
    if (!tasks || tasks.length === 0) {
      return [];
    }

    return tasks.filter((task) => {
      if (filters.myTask === 'my_task' && !isMyTask(task)) {
        return false;
      }

      if (filters.search && !matchesSearch(task, filters.search)) {
        return false;
      }

      if (filters.status && task.status !== filters.status) {
        return false;
      }

      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }

      if (filters.pic && !hasStepAssignedToPic(task, filters.pic)) {
        return false;
      }

      if (filters.dateRange && filters.dateRange !== 'all' && !matchesDateRange(task)) {
        return false;
      }

      return true;
    });
  }, [
    filters.dateRange,
    filters.myTask,
    filters.pic,
    filters.priority,
    filters.search,
    filters.status,
    hasStepAssignedToPic,
    isMyTask,
    matchesDateRange,
    matchesSearch,
    tasks,
  ]);

  const getVisibleSteps = useCallback(
    (task: Task): TaskStepEntity[] => {
      if (!task.steps || task.steps.length === 0) {
        return [];
      }

      if (filters.pic) {
        return task.steps.filter((step) => step.assigned_employee?.id === filters.pic);
      }

      if (filters.myTask === 'all') {
        return task.steps;
      }

      if (task.assigned_to === currentEmployeeId) {
        return task.steps;
      }

      return task.steps.filter(
        (step) =>
          step.assigned_to === currentEmployeeId ||
          step.created_by === currentUserId ||
          step.has_assigned_substeps
      );
    },
    [currentEmployeeId, currentUserId, filters.myTask, filters.pic]
  );

  return {
    filteredTasks,
    getVisibleSteps,
    isMyTask,
  };
};

