import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskStepRecord } from "../../db/dailyTasks";
import { taskId, taskTitle } from "./fields";

const stepDescriptionUpdate = z.union([z.string().trim().max(2000), z.null()]).describe(
  "Replacement description. Omit this field or send null to keep the current description. Send an empty string to clear it.",
);

export const updateStepSchema = z.object({
  id: taskId,
  title: taskTitle,
  description: stepDescriptionUpdate.optional(),
}).strict();

export function updateStepResult(
  ctx: McpAuthContext,
  input: { id: string; title: string; description: string | null },
  update: (ctx: McpAuthContext, input: { id: string; title: string; description: string | null }) => Promise<TaskStepRecord>,
): Promise<TaskStepRecord> {
  return update(ctx, input);
}
