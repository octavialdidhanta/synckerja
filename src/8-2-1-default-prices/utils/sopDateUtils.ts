import type { SopScheduleType } from "../types/sopTypes";

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

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDateString(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

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
