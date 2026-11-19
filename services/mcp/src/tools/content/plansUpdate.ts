import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ContentPlanRow } from "../../db/listContentPlans";
import { calendarDay } from "../inputs";

export const updatePlanSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  post_date: calendarDay.optional(),
}).strict();

export const updatePlanInput = updatePlanSchema.refine(
  (value) => value.title != null || value.post_date != null,
);

export function updatePlanResult(
  ctx: McpAuthContext,
  input: { id: string; title: string | null; postDate: string | null },
  update: (
    ctx: McpAuthContext,
    input: { id: string; title: string | null; postDate: string | null; brief: string | null; baseVersion: number | null },
  ) => Promise<ContentPlanRow>,
): Promise<ContentPlanRow> {
  return update(ctx, { ...input, brief: null, baseVersion: null });
}
