import type { Task } from '../types';

export interface TaskCheckboxRuleResult {
  taskHasSteps: boolean;
  isStepProgressFull: boolean;
  isChecked: boolean;
  isDisabled: boolean;
  reasonKey: 'completeAllStepsFirst' | 'cannotUncheckTaskDesc' | null;
}

/**
 * Shared rule for task checkbox behavior.
 * Tasks with steps are step-driven (manual toggle disabled).
 */
export function getTaskCheckboxRule(params: {
  task: Task;
  progress: number;
  visibleStepCount?: number;
}): TaskCheckboxRuleResult {
  const { task, progress, visibleStepCount } = params;
  const actualStepCount = Array.isArray(task.steps) ? task.steps.length : 0;
  const taskHasSteps =
    typeof visibleStepCount === 'number'
      ? visibleStepCount > 0 || actualStepCount > 0
      : actualStepCount > 0;

  if (!taskHasSteps) {
    const isChecked = task.status === 'completed';
    return {
      taskHasSteps,
      isStepProgressFull: isChecked,
      isChecked,
      isDisabled: false,
      reasonKey: null,
    };
  }

  const isStepProgressFull = progress >= 100;
  return {
    taskHasSteps: true,
    isStepProgressFull,
    isChecked: isStepProgressFull,
    isDisabled: true,
    reasonKey: isStepProgressFull ? 'cannotUncheckTaskDesc' : 'completeAllStepsFirst',
  };
}
