import { useState, useMemo, useCallback } from 'react';
import type { Task, TaskStep as TaskStepEntity } from '@/features/8-2-DailyTask/DailyTaskContext';

interface UseTaskModalProps {
  tasks: Task[];
  getVisibleSteps: (task: Task) => TaskStepEntity[];
  calculateProgress: (task: Task) => number;
}

/**
 * Custom hook for managing task modal state and calculations
 */
export const useTaskModal = ({
  tasks,
  getVisibleSteps,
  calculateProgress,
}: UseTaskModalProps) => {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null;
    return tasks.find((task) => task.id === activeTaskId) || null;
  }, [activeTaskId, tasks]);

  const activeVisibleSteps = useMemo(() => {
    if (!activeTask) return [] as TaskStepEntity[];
    return getVisibleSteps(activeTask);
  }, [activeTask, getVisibleSteps]);

  const activeProgress = useMemo(() => {
    if (!activeTask) return 0;
    return calculateProgress(activeTask);
  }, [activeTask, calculateProgress]);

  const openTaskModal = useCallback((taskId: string) => {
    setActiveTaskId(taskId);
  }, []);

  const closeTaskModal = useCallback(() => {
    setActiveTaskId(null);
  }, []);

  return {
    activeTaskId,
    activeTask,
    activeVisibleSteps,
    activeProgress,
    openTaskModal,
    closeTaskModal,
  };
};

