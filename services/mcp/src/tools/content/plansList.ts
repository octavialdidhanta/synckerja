import { z } from "zod";
import type { ContentPlanRow } from "../../db/listContentPlans";
import type { McpAuthContext } from "../../authz/context";

export const contentPlansInput = z.object({}).strict();

export async function contentPlansResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<ContentPlanRow[]>,
): Promise<ContentPlanRow[]> {
  return list(ctx);
}
