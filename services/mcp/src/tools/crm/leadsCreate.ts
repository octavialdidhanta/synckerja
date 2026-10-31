import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { CrmLeadRow } from "../../db/phase1Reads";

const blockedStatus = /^(?:converted|closed|resolve)$/i;

export const createLeadInput = z.object({
  client: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(200),
  source: z.string().trim().min(1).max(80).optional(),
  fu_priority: z.enum(["High", "Medium", "Low", "Please Follow Up"]).optional(),
  status: z.string().trim().min(1).max(80).refine((value) => !blockedStatus.test(value)).optional(),
}).strict();

export function createLeadResult(
  ctx: McpAuthContext,
  input: {
    client: string;
    title: string;
    category: string;
    source: string | null;
    fuPriority: string | null;
    status: string | null;
  },
  create: (
    ctx: McpAuthContext,
    input: {
      client: string;
      title: string;
      category: string;
      source: string | null;
      fuPriority: string | null;
      status: string | null;
    },
  ) => Promise<CrmLeadRow>,
): Promise<CrmLeadRow> {
  return create(ctx, input);
}
