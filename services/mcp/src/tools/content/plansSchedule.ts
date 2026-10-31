import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";

export type SchedulePlanResult = {
  eligible: boolean;
  scheduled: number;
  blocked: string[];
  skipped: { platform: string; reason: string }[];
  failed: { platform: string; reason: string }[];
};

export const schedulePlanInput = z.object({
  id: z.string().uuid(),
}).strict();

export function schedulePlanResult(
  ctx: McpAuthContext,
  id: string,
  schedule: (ctx: McpAuthContext, id: string) => Promise<SchedulePlanResult>,
): Promise<SchedulePlanResult> {
  return schedule(ctx, id);
}
