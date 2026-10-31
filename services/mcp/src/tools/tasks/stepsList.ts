import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskStepRow } from "../../db/dailyTasks";
import { taskId } from "./fields";

export const taskStepsInput = z.object({
  task_id: taskId,
}).strict();

export function taskStepsResult(
  ctx: McpAuthContext,
  taskId: string,
  list: (ctx: McpAuthContext, taskId: string) => Promise<TaskStepRow[]>,
): Promise<TaskStepRow[]> {
  return list(ctx, taskId);
}
