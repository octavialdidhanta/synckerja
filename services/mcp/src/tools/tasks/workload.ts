import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { WorkloadRow } from "../../db/dailyTasks";

export const taskWorkloadInput = z.object({
  timeframe: z.enum(["day", "week", "month"]).optional(),
}).strict();

export function taskWorkloadResult(
  ctx: McpAuthContext,
  timeframe: string | null,
  list: (ctx: McpAuthContext, timeframe: string | null) => Promise<WorkloadRow[]>,
): Promise<WorkloadRow[]> {
  return list(ctx, timeframe);
}
