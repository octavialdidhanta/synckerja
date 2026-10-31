import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { OkrCycleRow } from "../../db/phase1Reads";

export const cyclesInput = z.object({}).strict();

export async function cyclesResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<OkrCycleRow[]>,
): Promise<OkrCycleRow[]> {
  return list(ctx);
}
