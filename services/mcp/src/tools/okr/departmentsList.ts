import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { OkrDepartmentRow } from "../../db/phase1Reads";

export const departmentsInput = z.object({}).strict();

export async function departmentsResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<OkrDepartmentRow[]>,
): Promise<OkrDepartmentRow[]> {
  return list(ctx);
}
