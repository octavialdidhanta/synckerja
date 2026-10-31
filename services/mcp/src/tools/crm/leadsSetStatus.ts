import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { CrmLeadRow } from "../../db/phase1Reads";

const blockedStatus = /^(?:converted|closed|resolve)$/i;

export const setLeadStatusInput = z.object({
  id: z.string().uuid(),
  status: z.string().trim().min(1).max(80).refine((value) => !blockedStatus.test(value)),
}).strict();

export function setLeadStatusResult(
  ctx: McpAuthContext,
  input: { id: string; status: string },
  setStatus: (ctx: McpAuthContext, input: { id: string; status: string }) => Promise<CrmLeadRow>,
): Promise<CrmLeadRow> {
  return setStatus(ctx, input);
}
