import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TakeInitiativeInput, TakeInitiativeResult } from "../../db/dailyTasks";
import { taskDue, taskId, taskLevel } from "./fields";

export const takeInitiativeInput = z.object({
  id: taskId,
  level: taskLevel,
  due_date: taskDue,
  employee_id: taskId.optional(),
}).strict();

export function takeInitiativeResult(
  ctx: McpAuthContext,
  input: TakeInitiativeInput,
  take: (ctx: McpAuthContext, input: TakeInitiativeInput) => Promise<TakeInitiativeResult>,
): Promise<TakeInitiativeResult> {
  return take(ctx, input);
}
