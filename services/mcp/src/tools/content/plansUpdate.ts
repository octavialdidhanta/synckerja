import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ContentPlanRow } from "../../db/listContentPlans";
import { calendarDay } from "../inputs";

export const updatePlanInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  post_date: calendarDay.optional(),
  brief: z.string().trim().min(1).max(4000).optional(),
}).strict().refine((value) => value.title != null || value.post_date != null || value.brief != null);

export function updatePlanResult(
  ctx: McpAuthContext,
  input: { id: string; title: string | null; postDate: string | null; brief: string | null },
  update: (
    ctx: McpAuthContext,
    input: { id: string; title: string | null; postDate: string | null; brief: string | null },
  ) => Promise<ContentPlanRow>,
): Promise<ContentPlanRow> {
  return update(ctx, input);
}
