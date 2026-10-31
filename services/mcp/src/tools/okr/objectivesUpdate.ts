import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { OkrObjectiveRow } from "../../db/phase1Reads";

export const updateObjectiveSchema = z.object({
  id: z.string().uuid(),
  level: z.enum(["company", "department", "individual"]),
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["draft", "active", "completed", "cancelled"]).optional(),
}).strict();

export const updateObjectiveInput = updateObjectiveSchema.refine(
  (value) => value.title != null || value.status != null,
);

export function updateObjectiveResult(
  ctx: McpAuthContext,
  input: { id: string; level: "company" | "department" | "individual"; title: string | null; status: string | null },
  update: (
    ctx: McpAuthContext,
    input: { id: string; level: "company" | "department" | "individual"; title: string | null; status: string | null },
  ) => Promise<OkrObjectiveRow>,
): Promise<OkrObjectiveRow> {
  return update(ctx, input);
}
