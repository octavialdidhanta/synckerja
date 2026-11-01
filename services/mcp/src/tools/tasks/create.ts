import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { CreateTaskInput, TaskRecord } from "../../db/dailyTasks";
import { assertPlanMonth, taskDescription, taskDue, taskId, taskPlanMonth, taskPriority, taskTitle } from "./fields";

export const createTaskInput = z.object({
  title: taskTitle,
  plan_month: taskPlanMonth,
  description: taskDescription.optional(),
  priority: taskPriority.optional(),
  due_date: taskDue.optional(),
  employee_id: taskId.optional(),
}).strict();

export async function createTaskResult(
  ctx: McpAuthContext,
  input: CreateTaskInput,
  create: (ctx: McpAuthContext, input: CreateTaskInput) => Promise<TaskRecord>,
): Promise<TaskRecord> {
  assertPlanMonth(input.planMonth);
  return create(ctx, input);
}
