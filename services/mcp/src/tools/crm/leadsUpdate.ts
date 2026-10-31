import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { CrmLeadRow } from "../../db/phase1Reads";

export const updateLeadInput = z.object({
  id: z.string().uuid(),
  client: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(200).optional(),
  source: z.string().trim().min(1).max(80).optional(),
  fu_priority: z.enum(["High", "Medium", "Low", "Please Follow Up"]).optional(),
}).strict().refine((value) =>
  value.client != null || value.title != null || value.category != null || value.source != null || value.fu_priority != null,
);

export function updateLeadResult(
  ctx: McpAuthContext,
  input: {
    id: string;
    client: string | null;
    title: string | null;
    category: string | null;
    source: string | null;
    fuPriority: string | null;
  },
  update: (
    ctx: McpAuthContext,
    input: {
      id: string;
      client: string | null;
      title: string | null;
      category: string | null;
      source: string | null;
      fuPriority: string | null;
    },
  ) => Promise<CrmLeadRow>,
): Promise<CrmLeadRow> {
  return update(ctx, input);
}
