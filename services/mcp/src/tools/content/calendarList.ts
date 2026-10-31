import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ContentPlanRow } from "../../db/listContentPlans";

const monthPattern = /^[0-9]{4}-(?:0[1-9]|1[0-2])$/;

export const calendarInput = z.object({
  month: z.string().regex(monthPattern).optional(),
}).strict();

export async function calendarResult(
  ctx: McpAuthContext,
  month: string | null,
  list: (ctx: McpAuthContext, month: string | null) => Promise<ContentPlanRow[]>,
): Promise<ContentPlanRow[]> {
  return list(ctx, month);
}
