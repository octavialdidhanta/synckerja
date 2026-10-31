import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { HabitDayRow } from "../../db/habits";
import { calendarDay } from "../inputs";

export const habitsListInput = z.object({
  date: calendarDay.optional(),
}).strict();

export function habitsListResult(
  ctx: McpAuthContext,
  date: string | null,
  list: (ctx: McpAuthContext, date: string | null) => Promise<HabitDayRow[]>,
): Promise<HabitDayRow[]> {
  return list(ctx, date);
}
