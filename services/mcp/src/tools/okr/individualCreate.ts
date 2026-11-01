import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { IndividualObjectiveRecord } from "../../db/phase3Writes";

export const createIndividualObjectiveInput = z.object({
  department_objective_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000).optional(),
  status: z.enum(["draft", "active"]).optional(),
  employee_id: z.string().uuid().optional(),
}).strict();

export function createIndividualObjectiveResult(
  ctx: McpAuthContext,
  input: {
    departmentObjectiveId: string;
    title: string;
    description: string | null;
    status: string | null;
    employeeId: string | null;
  },
  create: (
    ctx: McpAuthContext,
    input: {
      departmentObjectiveId: string;
      title: string;
      description: string | null;
      status: string | null;
      employeeId: string | null;
    },
  ) => Promise<IndividualObjectiveRecord>,
): Promise<IndividualObjectiveRecord> {
  return create(ctx, input);
}
