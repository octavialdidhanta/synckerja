import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { AssignTaskInput, AssignTaskResult } from "../../db/dailyTasks";
import { taskDue, taskId } from "./fields";

export const assignTaskInput = z.object({
  id: taskId,
  employee_id: taskId,
  due_date: taskDue.optional(),
}).strict();

export function assignTaskResult(
  ctx: McpAuthContext,
  input: AssignTaskInput,
  assign: (ctx: McpAuthContext, input: AssignTaskInput) => Promise<AssignTaskResult>,
): Promise<AssignTaskResult> {
  return assign(ctx, input);
}
