import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskObjectiveLink } from "../../db/dailyTasks";

export const linkTaskObjectiveInput = z.object({
  task_id: z.string().uuid(),
  individual_objective_id: z.string().uuid(),
}).strict();

export function linkTaskObjectiveResult(
  ctx: McpAuthContext,
  input: { taskId: string; individualObjectiveId: string },
  link: (ctx: McpAuthContext, input: { taskId: string; individualObjectiveId: string }) => Promise<TaskObjectiveLink>,
): Promise<TaskObjectiveLink> {
  return link(ctx, input);
}
