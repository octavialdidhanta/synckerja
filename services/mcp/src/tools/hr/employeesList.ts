import type { McpAuthContext } from "../../authz/context";
import type { EmployeeRow } from "../../db/phase2Reads";
import { emptyInput } from "../inputs";

export const employeesInput = emptyInput;

export function employeesResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<EmployeeRow[]>,
): Promise<EmployeeRow[]> {
  return list(ctx);
}
