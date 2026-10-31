import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskStepRecord } from "../../db/dailyTasks";
import { taskDescription, taskId, taskTitle } from "./fields";

export const createStepInput = z.object({
  task_id: taskId,
  title: taskTitle,
  description: taskDescription.optional(),
}).strict();

export function createStepResult(
  ctx: McpAuthContext,
  input: { taskId: string; title: string; description: string | null },
  create: (ctx: McpAuthContext, input: { taskId: string; title: string; description: string | null }) => Promise<TaskStepRecord>,
): Promise<TaskStepRecord> {
  return create(ctx, input);
}
