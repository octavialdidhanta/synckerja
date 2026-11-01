import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { DepartmentObjectiveRecord } from "../../db/phase3Writes";

export const createDepartmentObjectiveInput = z.object({
  company_objective_id: z.string().uuid(),
  department_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000).optional(),
  status: z.enum(["draft", "active"]).optional(),
}).strict();

export function createDepartmentObjectiveResult(
  ctx: McpAuthContext,
  input: {
    companyObjectiveId: string;
    departmentId: string;
    title: string;
    description: string | null;
    status: string | null;
  },
  create: (
    ctx: McpAuthContext,
    input: {
      companyObjectiveId: string;
      departmentId: string;
      title: string;
      description: string | null;
      status: string | null;
    },
  ) => Promise<DepartmentObjectiveRecord>,
): Promise<DepartmentObjectiveRecord> {
  return create(ctx, input);
}
