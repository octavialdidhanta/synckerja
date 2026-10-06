/** Local calendar day at midnight, used to compare due dates without clock time. */
export function localCalendarDayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dueCalendarDayStart(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return localCalendarDayStart(date);
}

export function isDueOnLocalToday(iso: string | null | undefined, now = new Date()): boolean {
  const due = dueCalendarDayStart(iso);
  if (due == null) return false;
  return due === localCalendarDayStart(now);
}

/** Past calendar day and still open. Due today is not overdue. */
export function isOverdueIncomplete(
  iso: string | null | undefined,
  completed: boolean,
  now = new Date(),
): boolean {
  if (completed) return false;
  const due = dueCalendarDayStart(iso);
  if (due == null) return false;
  return due < localCalendarDayStart(now);
}

type TodayQueueSubStep = {
  is_completed?: boolean;
  assigned_due_date?: string | null;
};

type TodayQueueStep = {
  is_completed?: boolean;
  assigned_due_date?: string | null;
  sub_steps?: TodayQueueSubStep[];
};

type TodayQueueTask = {
  status?: string | null;
  due_date?: string | null;
  steps?: TodayQueueStep[];
};

/** A step stays in Today only when it, or one of its sub-steps, is due today or still overdue. */
export function stepBelongsInTodayQueue(step: TodayQueueStep, now = new Date()): boolean {
  if (isDueOnLocalToday(step.assigned_due_date, now)) return true;
  if (isOverdueIncomplete(step.assigned_due_date, step.is_completed === true, now)) return true;
  return (step.sub_steps ?? []).some(
    (subStep) =>
      isDueOnLocalToday(subStep.assigned_due_date, now) ||
      isOverdueIncomplete(subStep.assigned_due_date, subStep.is_completed === true, now),
  );
}

/**
 * Today is the working day: anything due today, plus unfinished work whose due date already passed.
 */
export function taskMatchesTodayWorkQueue(task: TodayQueueTask, now = new Date()): boolean {
  if (isDueOnLocalToday(task.due_date, now)) return true;
  const taskClosed = task.status === 'completed' || task.status === 'cancelled';
  if (!taskClosed && isOverdueIncomplete(task.due_date, false, now)) return true;

  for (const step of task.steps ?? []) {
    if (isDueOnLocalToday(step.assigned_due_date, now)) return true;
    if (isOverdueIncomplete(step.assigned_due_date, step.is_completed === true, now)) return true;
    for (const subStep of step.sub_steps ?? []) {
      if (isDueOnLocalToday(subStep.assigned_due_date, now)) return true;
      if (isOverdueIncomplete(subStep.assigned_due_date, subStep.is_completed === true, now)) return true;
    }
  }
  return false;
}
