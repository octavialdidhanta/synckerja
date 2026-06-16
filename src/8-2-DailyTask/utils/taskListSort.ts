import type { Task } from '@/8-2-DailyTask/types';

export type TaskTitleSortDirection = 'asc' | 'desc';

/** Alphabetical task title sort for summary table (desktop). */
export function sortTasksByTitle(tasks: Task[], direction: TaskTitleSortDirection): Task[] {
  const mult = direction === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    const titleA = (a.title ?? '').trim().toLocaleLowerCase();
    const titleB = (b.title ?? '').trim().toLocaleLowerCase();
    const cmp = titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return mult * cmp;
    return a.id.localeCompare(b.id);
  });
}
