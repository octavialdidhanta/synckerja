import { format, differenceInDays, startOfDay } from 'date-fns';
import type { Task, TaskStep as TaskStepEntity } from '@/features/8-2-DailyTask/DailyTaskContext';

/**
 * Format date to locale string
 */
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Check if task is overdue
 */
export const isOverdue = (dueDate: string | null, status: string): boolean => {
  if (!dueDate || status === 'completed') return false;
  return new Date(dueDate) < new Date();
};

/**
 * Get days remaining until due date
 */
export const getDaysRemaining = (dueDate: string | null, status: string): number | null => {
  if (!dueDate || status === 'completed') return null;
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueDate));
  return differenceInDays(due, today);
};

/**
 * Format days remaining as human-readable string
 */
export const formatDaysRemaining = (days: number | null): string => {
  if (days === null) return '';
  if (days < 0) return `${Math.abs(days)} hari lalu`;
  if (days === 0) return 'Hari ini';
  if (days === 1) return 'Besok';
  return `${days} hari lagi`;
};

/**
 * Calculate progress percentage based on completed steps
 */
export const calculateProgress = (
  visibleSteps: TaskStepEntity[]
): number => {
  if (visibleSteps.length === 0) return 0;
  const completedSteps = visibleSteps.filter((step) => step.is_completed).length;
  return Math.round((completedSteps / visibleSteps.length) * 100);
};

/**
 * Get status badge label
 */
export const getStatusLabel = (status: string): string => {
  return status.replace('_', ' ').toUpperCase();
};

/**
 * Get priority label
 */
export const getPriorityLabel = (priority: string): string => {
  return priority.toUpperCase();
};

/**
 * Check if user is task creator
 */
export const isTaskCreator = (task: Task, userId: string | undefined): boolean => {
  return task.created_by === userId;
};

