import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { HabitCheckInput, HabitCheckResult } from "../../db/habits";
import { calendarDay } from "../inputs";

export const habitCheckInput = z.object({
  habit_id: z.string().uuid(),
  checked: z.boolean(),
  date: calendarDay.optional(),
  index: z.number().int().min(0).max(99).optional(),
}).strict();

export function habitCheckResult(
  ctx: McpAuthContext,
  input: HabitCheckInput,
  check: (ctx: McpAuthContext, input: HabitCheckInput) => Promise<HabitCheckResult>,
): Promise<HabitCheckResult> {
  return check(ctx, input);
}
