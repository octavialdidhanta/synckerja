import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { CrmLeadRow } from "../../db/phase1Reads";

export const leadsInput = z.object({
  status: z.string().trim().min(1).max(80).optional(),
}).strict();

export async function leadsResult(
  ctx: McpAuthContext,
  status: string | null,
  list: (ctx: McpAuthContext, status: string | null) => Promise<CrmLeadRow[]>,
): Promise<CrmLeadRow[]> {
  return list(ctx, status);
}
