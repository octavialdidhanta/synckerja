import { z } from "zod";

export const monthPattern = /^[0-9]{4}-(?:0[1-9]|1[0-2])$/;
export const dayPattern = /^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$/;

export function isCalendarDay(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const calendarDay = z.string().regex(dayPattern).refine(isCalendarDay);

export const monthInput = z.object({
  month: z.string().regex(monthPattern).optional(),
}).strict();

export const emptyInput = z.object({}).strict();
