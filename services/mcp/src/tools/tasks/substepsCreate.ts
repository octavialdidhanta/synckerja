import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskSubstepRecord } from "../../db/dailyTasks";
import { taskId, taskTitle } from "./fields";

export const createSubstepInput = z.object({
  step_id: taskId,
  title: taskTitle,
}).strict();

export function createSubstepResult(
  ctx: McpAuthContext,
  input: { stepId: string; title: string },
  create: (ctx: McpAuthContext, input: { stepId: string; title: string }) => Promise<TaskSubstepRecord>,
): Promise<TaskSubstepRecord> {
  return create(ctx, input);
}
