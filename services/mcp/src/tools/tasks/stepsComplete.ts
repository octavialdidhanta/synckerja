import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskStepCompletionRecord } from "../../db/dailyTasks";
import { taskId } from "./fields";

export const completeStepSchema = z.object({
  id: taskId,
  completed: z
    .boolean()
    .optional()
    .describe("true marks the step completed (default). false reopens it."),
}).strict();

export type CompleteStepInput = { id: string; completed: boolean };

export function completeStepResult(
  ctx: McpAuthContext,
  input: CompleteStepInput,
  complete: (ctx: McpAuthContext, input: CompleteStepInput) => Promise<TaskStepCompletionRecord>,
): Promise<TaskStepCompletionRecord> {
  return complete(ctx, input);
}
