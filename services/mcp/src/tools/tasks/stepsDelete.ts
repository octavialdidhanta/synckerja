import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import { taskId } from "./fields";

export const deleteStepInput = z.object({
  id: taskId,
}).strict();

export function deleteStepResult(
  ctx: McpAuthContext,
  id: string,
  remove: (ctx: McpAuthContext, id: string) => Promise<{ id: string }>,
): Promise<{ id: string }> {
  return remove(ctx, id);
}
