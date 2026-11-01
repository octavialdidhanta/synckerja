import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ContentPlanRow } from "../../db/listContentPlans";
import { monthPattern } from "../inputs";

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
