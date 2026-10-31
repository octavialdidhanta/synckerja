import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { OkrObjectiveRow } from "../../db/phase1Reads";

export const createObjectiveInput = z.object({
  cycle_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  why_important: z.string().trim().min(1).max(2000).optional(),
  status: z.enum(["draft", "active"]).optional(),
}).strict();

export function createObjectiveResult(
  ctx: McpAuthContext,
  input: { cycleId: string; title: string; whyImportant: string | null; status: string | null },
  create: (
    ctx: McpAuthContext,
    input: { cycleId: string; title: string; whyImportant: string | null; status: string | null },
  ) => Promise<OkrObjectiveRow>,
): Promise<OkrObjectiveRow> {
  return create(ctx, input);
}
