import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { OkrObjectiveListRow } from "../../db/phase1Reads";

export const objectivesInput = z.object({
  cycle_id: z.string().uuid().optional(),
}).strict();

export async function objectivesResult(
  ctx: McpAuthContext,
  cycleId: string | null,
  list: (ctx: McpAuthContext, cycleId: string | null) => Promise<OkrObjectiveListRow[]>,
): Promise<OkrObjectiveListRow[]> {
  return list(ctx, cycleId);
}
