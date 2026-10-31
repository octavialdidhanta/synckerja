import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ContentPlanRow } from "../../db/listContentPlans";
import { calendarDay } from "../inputs";

export const createPlanInput = z.object({
  title: z.string().trim().min(1).max(200),
  post_date: calendarDay.optional(),
  brief: z.string().trim().min(1).max(4000).optional(),
}).strict();

export function createPlanResult(
  ctx: McpAuthContext,
  input: { title: string; postDate: string | null; brief: string | null },
  create: (
    ctx: McpAuthContext,
    input: { title: string; postDate: string | null; brief: string | null },
  ) => Promise<ContentPlanRow>,
): Promise<ContentPlanRow> {
  return create(ctx, input);
}
