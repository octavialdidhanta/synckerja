import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskStepRecord } from "../../db/dailyTasks";
import { taskId, taskTitle } from "./fields";

export const updateStepSchema = z.object({
  id: taskId,
  title: taskTitle,
}).strict();

export function updateStepResult(
  ctx: McpAuthContext,
  input: { id: string; title: string },
  update: (ctx: McpAuthContext, input: { id: string; title: string }) => Promise<TaskStepRecord>,
): Promise<TaskStepRecord> {
  return update(ctx, input);
}
