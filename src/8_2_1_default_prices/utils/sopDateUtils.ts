/**
 * Date helpers used by Daily Task step due-date computation (Hari H).
 *
 * This file is a small port/shim from `synckerja-reference` so that
 * `/tools/daily-task` build can succeed.
 */

export type SopScheduleType = "days_before_h" | "hari_h" | "working_days_after_h";

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function nextWorkingDay(d: Date): Date {
  const out = new Date(d);
  while (isWeekend(out)) {
    out.setDate(out.getDate() + 1);
  }
  return out;
}

function addWorkingDaysAfter(startDate: Date, n: number): Date {
  if (n <= 0) return new Date(startDate);
  let d = new Date(startDate);
  for (let i = 0; i < n; i++) {
    d.setDate(d.getDate() + 1);
    d = nextWorkingDay(d);
  }
  return d;
}

/**
 * Format date as YYYY-MM-DD in local time (avoid UTC shift).
 */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Compute step due date from Hari H and template step schedule.
 * - days_before_h: Hari H minus schedule_value calendar days.
 * - hari_h: Hari H.
 * - working_days_after_h: schedule_value working days after the first working day on or after Hari H.
 *
 * Uses local date so timezone does not shift the day.
 */
export function computeStepDueDate(
  hariHDate: Date,
  scheduleType: SopScheduleType,
  scheduleValue: number | null,
): string {
  const h = new Date(hariHDate);
  h.setHours(0, 0, 0, 0);

  switch (scheduleType) {
    case "days_before_h": {
      const v = scheduleValue ?? 0;
      const d = new Date(h);
      d.setDate(d.getDate() - v);
      return toLocalDateString(d);
    }
    case "hari_h":
      return toLocalDateString(h);
    case "working_days_after_h": {
      const v = scheduleValue ?? 0;
      const firstWorking = nextWorkingDay(h);
      const due = addWorkingDaysAfter(firstWorking, v);
      return toLocalDateString(due);
    }
    default:
      return toLocalDateString(h);
  }
}

