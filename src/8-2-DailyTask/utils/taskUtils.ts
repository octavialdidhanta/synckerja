import { supabase } from '@/shared/lib/supabaseClient';
import { TaskStep } from '../types/taskTypes';

/**
 * Calculate progress percentage based on completed steps
 * If no steps exist, progress is based on task status:
 * - status = 'completed' → 100%
 * - status != 'completed' → 0%
 */
export const calculateProgress = (steps: TaskStep[], taskStatus?: string): number => {
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    // If no steps, progress is based on status
    // This ensures that tasks without steps show 100% when completed
    return taskStatus === 'completed' ? 100 : 0;
  }
  const completedSteps = steps.filter(step => step && step.is_completed).length;
  return Math.round((completedSteps / steps.length) * 100);
};

/**
 * Result of effective progress (considering sub-steps) for consistent badge and progress bar.
 */
export interface EffectiveProgressResult {
  progress: number;
  completedCount: number;
  totalCount: number;
}

/**
 * Calculate progress and counts considering sub-steps so badge (X/Y) and progress bar stay in sync.
 * - Step without sub_steps: 1 item, completed = 1 if step.is_completed else 0.
 * - Step with sub_steps: total = sub_steps.length, completed = count of sub_steps where is_completed.
 */
export function getEffectiveProgressAndCount(
  steps: Array<{ is_completed: boolean; sub_steps?: Array<{ is_completed: boolean }> }>
): EffectiveProgressResult {
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return { progress: 0, completedCount: 0, totalCount: 0 };
  }
  let completed = 0;
  let total = 0;
  for (const step of steps) {
    if (!step) continue;
    if (step.sub_steps && step.sub_steps.length > 0) {
      completed += step.sub_steps.filter((s) => s.is_completed).length;
      total += step.sub_steps.length;
    } else {
      completed += step.is_completed ? 1 : 0;
      total += 1;
    }
  }
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { progress, completedCount: completed, totalCount: total };
}

/**
 * Determine task status from progress
 */
export const determineStatusFromProgress = (progress: number, currentStatus: string): string => {
  // Cancelled remains cancelled
  if (currentStatus === 'cancelled') return 'cancelled';
  if (progress >= 100) return 'completed';
  if (progress <= 0) return 'pending';
  return 'in_progress';
};

/**
 * Calculate step progress from sub-steps
 * @returns Progress percentage (0-100) or -1 if no sub-steps exist
 */
export const calculateStepProgressFromSubSteps = async (stepId: string): Promise<number> => {
  try {
    const { data: subSteps, error } = await supabase
      .from('task_steps_to_steps')
      .select('is_completed')
      .eq('parent_step_id', stepId);

    if (error || !subSteps || subSteps.length === 0) {
      // If no sub-steps, return -1 to indicate no sub-steps
      return -1;
    }

    const completedSubSteps = subSteps.filter((s: any) => s.is_completed).length;
    return Math.round((completedSubSteps / subSteps.length) * 100);
  } catch (error) {
    console.error('Error calculating step progress from sub-steps:', error);
    return -1;
  }
};

/**
 * Auto-reorder steps: completed steps go to bottom, incomplete steps go to top
 * Priority: 0% progress > <100% progress > 100% progress or completed
 * @returns New order mapping for local state update, or null if error
 */
export const autoReorderTaskSteps = async (
  taskId: string
): Promise<Array<{ stepId: string; newOrder: number }> | null> => {
  try {
    // Get all steps for this task with their sub-step progress
    const { data: steps, error: stepsError } = await supabase
      .from('task_steps')
      .select('id, is_completed, order')
      .eq('task_id', taskId)
      .order('order', { ascending: true });

    if (stepsError || !steps || steps.length === 0) {
      return null;
    }

    // Calculate progress for each step (from sub-steps if available)
    const stepsWithProgress = await Promise.all(
      steps.map(async (step: any) => {
        const subStepProgress = await calculateStepProgressFromSubSteps(step.id);
        // If step has sub-steps, use sub-step progress
        // If step doesn't have sub-steps, use is_completed: completed = 100%, not completed = 0%
        const progress = subStepProgress === -1 ? (step.is_completed ? 100 : 0) : subStepProgress;

        return {
          ...step,
          progress,
          hasSubSteps: subStepProgress !== -1,
        };
      })
    );

    // Sort steps according to requirements:
    // 1. Steps with 0% progress (not completed, no progress from sub-steps) - highest priority (top)
    // 2. Steps with progress > 0% and < 100% - medium priority (middle)
    // 3. Steps with 100% progress or is_completed = true - lowest priority (bottom)
    const sortedSteps = stepsWithProgress.sort((a, b) => {
      // Determine if step is "complete" (100% or is_completed = true)
      const aIsComplete = a.progress === 100 || a.is_completed;
      const bIsComplete = b.progress === 100 || b.is_completed;

      // If both are complete, maintain original order among completed steps
      if (aIsComplete && bIsComplete) {
        return a.order - b.order;
      }

      // If a is complete and b is not, b should come first (b goes up)
      if (aIsComplete && !bIsComplete) {
        return 1;
      }

      // If a is not complete and b is complete, a should come first (a goes up)
      if (!aIsComplete && bIsComplete) {
        return -1;
      }

      // Both are not complete
      // Priority: 0% progress (no progress) > >0% progress (some progress but not 100%)
      if (a.progress === 0 && b.progress > 0 && b.progress < 100) {
        return -1; // a (0%) comes before b (>0% but <100%)
      }

      if (a.progress > 0 && a.progress < 100 && b.progress === 0) {
        return 1; // b (0%) comes before a (>0% but <100%)
      }

      // If both have same progress category (both 0% or both >0% but <100%), maintain original order
      return a.order - b.order;
    });

    // Update order for each step
    const updatePromises = sortedSteps.map((step, index) =>
      supabase
        .from('task_steps')
        .update({ order: index + 1 })
        .eq('id', step.id)
    );

    await Promise.all(updatePromises);

    // Return the new order mapping for local state update
    return sortedSteps.map((step, index) => ({
      stepId: step.id,
      newOrder: index + 1,
    }));
  } catch (error) {
    console.error('Error auto-reordering task steps:', error);
    // Don't throw error - this is a background operation
    return null;
  }
};

