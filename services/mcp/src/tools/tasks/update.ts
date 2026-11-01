import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskRecord, UpdateTaskInput } from "../../db/dailyTasks";
import { assertPlanMonth, taskDue, taskId, taskPlanMonth, taskPriority, taskTitle } from "./fields";

export const updateTaskSchema = z.object({
  id: taskId,
  title: taskTitle.optional(),
  priority: taskPriority.optional(),
  due_date: taskDue.optional(),
  plan_month: taskPlanMonth.optional(),
}).strict();

export const updateTaskInput = updateTaskSchema.refine((value) =>
  value.title != null || value.priority != null || value.due_date != null || value.plan_month != null,
);

export async function updateTaskResult(
  ctx: McpAuthContext,
  input: UpdateTaskInput,
  update: (ctx: McpAuthContext, input: UpdateTaskInput) => Promise<TaskRecord>,
): Promise<TaskRecord> {
  if (input.planMonth != null) assertPlanMonth(input.planMonth);
  return update(ctx, input);
}
