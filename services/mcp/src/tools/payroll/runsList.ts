import type { McpAuthContext } from "../../authz/context";
import type { PayrollRunRow } from "../../db/payrollPosReads";
import { monthInput } from "../inputs";

export const payrollRunsInput = monthInput;

export function payrollRunsResult(
  ctx: McpAuthContext,
  month: string | null,
  list: (ctx: McpAuthContext, month: string | null) => Promise<PayrollRunRow[]>,
): Promise<PayrollRunRow[]> {
  return list(ctx, month);
}
