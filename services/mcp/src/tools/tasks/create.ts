import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { CreateTaskInput, TaskRecord } from "../../db/dailyTasks";
import { taskDescription, taskDue, taskId, taskPriority, taskTitle } from "./fields";

export const createTaskInput = z.object({
  title: taskTitle,
  description: taskDescription.optional(),
  priority: taskPriority.optional(),
  due_date: taskDue.optional(),
  employee_id: taskId.optional(),
}).strict();

export function createTaskResult(
  ctx: McpAuthContext,
  input: CreateTaskInput,
  create: (ctx: McpAuthContext, input: CreateTaskInput) => Promise<TaskRecord>,
): Promise<TaskRecord> {
  return create(ctx, input);
}
