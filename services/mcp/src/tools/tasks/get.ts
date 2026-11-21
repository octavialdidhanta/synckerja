import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskDetail } from "../../db/dailyTasks";
import { taskId } from "./fields";

export const getTaskInput = z.object({
  task_id: taskId,
}).strict();

export function getTaskResult(
  ctx: McpAuthContext,
  taskId: string,
  get: (ctx: McpAuthContext, taskId: string) => Promise<TaskDetail>,
): Promise<TaskDetail> {
  return get(ctx, taskId);
}
