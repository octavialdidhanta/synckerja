import { z } from "zod";
import { calendarDay, monthPattern } from "../inputs";

export const taskPriority = z.enum(["low", "medium", "high", "urgent", "needs_to_be_presented"]);
export const taskStatus = z.enum(["pending", "in_progress", "completed", "cancelled"]);
export const taskLevel = z.enum(["task", "step", "substep"]);
export const taskTitle = z.string().trim().min(1).max(200);
export const taskDescription = z.string().trim().min(1).max(2000);
export const taskDue = calendarDay;
export const taskPlanMonth = z.string().regex(monthPattern);
export const taskId = z.string().uuid();
