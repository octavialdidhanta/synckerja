import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Flag } from 'lucide-react';
import { differenceInDays, startOfDay } from 'date-fns';
import type { Task } from '../../types';
import { getEffectiveProgressAndCount } from '../../utils/taskUtils';

export function getStatusBadge(status: string) {
  const variants: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700 border-gray-200',
    in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <Badge
      className={`${variants[status] || ''} px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap hover:bg-inherit hover:text-inherit hover:opacity-100`}
    >
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  );
}

export function getPriorityBadge(priority: string) {
  const variants: Record<string, string> = {
    low: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-blue-100 text-blue-700 border-blue-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    urgent: 'bg-red-100 text-red-700 border-red-200',
    needs_to_be_presented: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  const displayText: Record<string, string> = {
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
    urgent: 'URGENT',
    needs_to_be_presented: 'PRESENTATION',
  };
  return (
    <Badge
      className={`${variants[priority] || ''} px-2 py-1 text-xs font-medium rounded-md hover:bg-inherit hover:text-inherit hover:opacity-100`}
    >
      <Flag className="w-3 h-3 mr-1" />
      {displayText[priority] || priority.toUpperCase()}
    </Badge>
  );
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === 'completed') return false;
  return new Date(dueDate) < new Date();
}

export function getDaysRemaining(dueDate: string | null, status: string): number | null {
  if (!dueDate || status === 'completed') return null;
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueDate));
  return differenceInDays(due, today);
}

export function formatDaysRemaining(days: number | null): string {
  if (days === null) return '';
  if (days < 0) return `${Math.abs(days)} hari lalu`;
  if (days === 0) return 'Hari ini';
  if (days === 1) return 'Besok';
  return `${days} hari lagi`;
}

export function isTaskCreator(task: Task, userId: string | undefined): boolean {
  return task.created_by === userId;
}

export function isTaskFullyCompleteBySteps(task: Task): boolean {
  const steps = task.steps ?? [];
  if (steps.length > 0) {
    const completedCount = steps.filter((s) => s.is_completed).length;
    return completedCount === steps.length;
  }
  if (task.has_substeps === false) {
    return task.status === 'completed';
  }
  return task.status === 'completed';
}

export function calculateAssignedStepsProgress(
  task: Task,
  visibleSteps: { is_completed: boolean; sub_steps?: Array<{ is_completed: boolean }> }[]
): number {
  if (visibleSteps.length === 0) {
    return task.status === 'completed' ? 100 : 0;
  }
  return getEffectiveProgressAndCount(visibleSteps).progress;
}
