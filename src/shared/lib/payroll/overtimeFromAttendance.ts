import {
  OVERTIME_FIRST_HOUR_MULTIPLIER,
  OVERTIME_HOURS_DIVISOR,
  OVERTIME_NEXT_HOUR_MULTIPLIER,
} from "./constants";

export interface OvertimeAttendanceRecord {
  checkInAt: string | Date;
  checkOutAt: string | Date | null;
  scheduledEndTime: string;
  overtimeThresholdMinutes?: number;
  /** Shift break extends effective end before overtime starts (shift source only). */
  breakDurationMinutes?: number;
  scheduleSource?: "shift" | "work_schedule";
}

export interface OvertimeResult {
  totalMinutes: number;
  totalHours: number;
  overtimePay: number;
  breakdown: Array<{ date: string; minutes: number; pay: number }>;
}

function parseTimeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function calculateOvertimePay(
  basicSalary: number,
  records: OvertimeAttendanceRecord[],
): OvertimeResult {
  const hourlyRate = basicSalary / OVERTIME_HOURS_DIVISOR;
  let totalMinutes = 0;
  const breakdown: OvertimeResult["breakdown"] = [];

  for (const record of records) {
    if (!record.checkOutAt) continue;

    const checkIn = toDate(record.checkInAt);
    const checkOut = toDate(record.checkOutAt);
    let scheduledEnd = parseTimeToMinutes(record.scheduledEndTime);
    if (
      record.scheduleSource === "shift" &&
      (record.breakDurationMinutes ?? 0) > 0
    ) {
      scheduledEnd += record.breakDurationMinutes!;
    }
    const threshold = record.overtimeThresholdMinutes ?? 0;
    const checkoutMinutes = minutesFromMidnight(checkOut);

    const rawMinutes = Math.max(0, checkoutMinutes - scheduledEnd - threshold);
    if (rawMinutes <= 0) continue;

    totalMinutes += rawMinutes;
    const hours = rawMinutes / 60;
    const firstHour = Math.min(1, hours);
    const nextHours = Math.max(0, hours - 1);
    const pay =
      firstHour * hourlyRate * OVERTIME_FIRST_HOUR_MULTIPLIER +
      nextHours * hourlyRate * OVERTIME_NEXT_HOUR_MULTIPLIER;

    breakdown.push({
      date: checkIn.toISOString().slice(0, 10),
      minutes: rawMinutes,
      pay: Math.round(pay),
    });
  }

  const totalHours = totalMinutes / 60;
  const firstHourTotal = Math.min(1, totalHours);
  const nextHoursTotal = Math.max(0, totalHours - 1);
  const overtimePay = Math.round(
    firstHourTotal * hourlyRate * OVERTIME_FIRST_HOUR_MULTIPLIER +
      nextHoursTotal * hourlyRate * OVERTIME_NEXT_HOUR_MULTIPLIER,
  );

  return { totalMinutes, totalHours, overtimePay, breakdown };
}
