export interface ProrateInput {
  periodStart: string | Date;
  periodEnd: string | Date;
  /** App convention: 1=Mon … 7=Sun */
  workingDays: number[];
  /** ISO date strings (YYYY-MM-DD) */
  holidayDates?: string[];
  countNationalHolidayAsWorkingDay?: boolean;
  employeeJoinDate?: string | Date | null;
  employeeEndDate?: string | Date | null;
  /** When set, numerator/denominator use shift-assigned working days only. */
  shiftAssignedDays?: string[];
}

export interface ProrateResult {
  totalWorkingDays: number;
  effectiveWorkingDays: number;
  ratio: number;
  mode: "wss" | "shift_assigned";
}

function toDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Mirrors pg_dow_to_app_dow: 1=Mon … 7=Sun */
export function pgDowToAppDow(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

function isWorkingDay(
  date: Date,
  workingDays: number[],
  holidaySet: Set<string>,
  countHolidayAsWorking: boolean,
): boolean {
  const iso = toIsoDate(date);
  const isHoliday = holidaySet.has(iso);
  if (isHoliday && !countHolidayAsWorking) return false;
  return workingDays.includes(pgDowToAppDow(date.getDay()));
}

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function countShiftAssignedWorkingDays(
  periodStart: string | Date,
  periodEnd: string | Date,
  shiftAssignedDays: string[],
  holidayDates: string[] = [],
  countHolidayAsWorking = false,
): number {
  const start = toDateOnly(periodStart);
  const end = toDateOnly(periodEnd);
  const shiftSet = new Set(shiftAssignedDays);
  const holidaySet = new Set(holidayDates);

  return eachDay(start, end).filter((date) => {
    const iso = toIsoDate(date);
    if (!shiftSet.has(iso)) return false;
    const isHoliday = holidaySet.has(iso);
    if (isHoliday && !countHolidayAsWorking) return false;
    return true;
  }).length;
}

export function calculateProrateRatio(input: ProrateInput): ProrateResult {
  const periodStart = toDateOnly(input.periodStart);
  const periodEnd = toDateOnly(input.periodEnd);
  const workingDays = input.workingDays.length > 0 ? input.workingDays : [1, 2, 3, 4, 5];
  const holidaySet = new Set(input.holidayDates ?? []);
  const countHolidayAsWorking = input.countNationalHolidayAsWorkingDay === true;
  const useShiftDays = (input.shiftAssignedDays?.length ?? 0) > 0;

  const joinDate = input.employeeJoinDate ? toDateOnly(input.employeeJoinDate) : null;
  const endDate = input.employeeEndDate ? toDateOnly(input.employeeEndDate) : null;

  const effectiveStart =
    joinDate && joinDate > periodStart ? joinDate : periodStart;
  const effectiveEnd =
    endDate && endDate < periodEnd ? endDate : periodEnd;

  if (effectiveStart > effectiveEnd) {
    return { totalWorkingDays: 0, effectiveWorkingDays: 0, ratio: 0, mode: useShiftDays ? "shift_assigned" : "wss" };
  }

  if (useShiftDays) {
    const totalWorkingDays = countShiftAssignedWorkingDays(
      periodStart,
      periodEnd,
      input.shiftAssignedDays!,
      input.holidayDates,
      countHolidayAsWorking,
    );
    const effectiveWorkingDays = countShiftAssignedWorkingDays(
      effectiveStart,
      effectiveEnd,
      input.shiftAssignedDays!,
      input.holidayDates,
      countHolidayAsWorking,
    );
    const ratio =
      totalWorkingDays > 0 ? Math.min(1, effectiveWorkingDays / totalWorkingDays) : 1;
    return { totalWorkingDays, effectiveWorkingDays, ratio, mode: "shift_assigned" };
  }

  const allDays = eachDay(periodStart, periodEnd);
  const effectiveDays = eachDay(effectiveStart, effectiveEnd);

  const totalWorkingDays = allDays.filter((d) =>
    isWorkingDay(d, workingDays, holidaySet, countHolidayAsWorking),
  ).length;

  const effectiveWorkingDays = effectiveDays.filter((d) =>
    isWorkingDay(d, workingDays, holidaySet, countHolidayAsWorking),
  ).length;

  const ratio =
    totalWorkingDays > 0 ? Math.min(1, effectiveWorkingDays / totalWorkingDays) : 1;

  return { totalWorkingDays, effectiveWorkingDays, ratio, mode: "wss" };
}
