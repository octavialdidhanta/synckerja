const JAKARTA_TIME_ZONE = 'Asia/Jakarta';
const OPEN_STATUSES = new Set(['pending', 'in_progress']);

/** Calendar date in Asia/Jakarta as YYYY-MM-DD. */
export function jakartaCalendarDate(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: JAKARTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

/** Start of the current Jakarta calendar day, as a UTC instant. Due dates before this are past. */
export function jakartaOverdueCutoffIso(now: Date = new Date()): string {
  const today = jakartaCalendarDate(now);
  if (!today) return new Date(0).toISOString();
  return new Date(`${today}T00:00:00+07:00`).toISOString();
}

/**
 * Pending or in-progress work whose due calendar day in Asia/Jakarta is before today.
 * A missing due date is not overdue. Due today is not overdue. Completed and cancelled are not overdue.
 */
export function isJakartaDateBeforeToday(value: string | null | undefined, now: Date = new Date()): boolean {
  if (value == null || String(value).trim() === '') return false;
  const due = jakartaCalendarDate(value);
  const today = jakartaCalendarDate(now);
  if (!due || !today) return false;
  return due < today;
}

export function isOpenOverdueInJakarta(
  dueDate: string | null | undefined,
  status: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!OPEN_STATUSES.has((status ?? '').toLowerCase())) return false;
  return isJakartaDateBeforeToday(dueDate, now);
}

export function isPlanMonthBefore(planDate: string | null | undefined, selectedMonthStart: string): boolean {
  if (!planDate) return false;
  const plan = jakartaCalendarDate(planDate);
  if (!plan) return false;
  return plan.slice(0, 7) < selectedMonthStart.slice(0, 7);
}

export type PlanMonthTask = {
  plan_date?: string | null;
  due_date?: string | null;
  status?: string | null;
};

/** Selected plan month, plus earlier unfinished tasks whose due date has already passed. */
export function belongsInSelectedPlanMonth(
  task: PlanMonthTask,
  selectedMonthStart: string,
  now: Date = new Date(),
): boolean {
  const plan = task.plan_date ? jakartaCalendarDate(task.plan_date) : null;
  if (plan && plan.slice(0, 7) === selectedMonthStart.slice(0, 7)) return true;
  return isPlanMonthBefore(task.plan_date, selectedMonthStart)
    && isOpenOverdueInJakarta(task.due_date, task.status, now);
}

export function mergeTasksById<T extends { id: string }>(monthRows: T[], carryRows: T[]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const row of [...monthRows, ...carryRows]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}
