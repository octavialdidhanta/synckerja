import { z } from "zod";
import { dayPattern, isCalendarDay, monthPattern } from "../inputs";

export const taskPriority = z.enum(["low", "medium", "high", "urgent", "needs_to_be_presented"]);
export const taskStatus = z.enum(["pending", "in_progress", "completed", "cancelled"]);
export const taskLevel = z.enum(["task", "step", "substep"]);
export const taskTitle = z.string().trim().min(1).max(200);
export const taskDescription = z.string().trim().min(1).max(2000);
export const taskDue = z
  .string()
  .refine((value) => dayPattern.test(value) && isCalendarDay(value))
  .describe("Due date as YYYY-MM-DD. It may fall in a different month from plan_month.");
export const taskPlanMonth = z
  .string()
  .refine((value) => monthPattern.test(value))
  .describe("Plan month as YYYY-MM, for example 2026-11. This is the Office month bucket and is separate from the due date.");
export const taskId = z.string().uuid();
