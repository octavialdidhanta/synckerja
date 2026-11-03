import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskSubstepRow } from "../../db/dailyTasks";
import { taskId } from "./fields";

export const listSubstepsInput = z.object({
  step_id: taskId,
}).strict();

export function listSubstepsResult(
  ctx: McpAuthContext,
  stepId: string,
  list: (ctx: McpAuthContext, stepId: string) => Promise<TaskSubstepRow[]>,
): Promise<TaskSubstepRow[]> {
  return list(ctx, stepId);
}
