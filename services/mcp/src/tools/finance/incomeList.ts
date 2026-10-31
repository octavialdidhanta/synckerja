import type { McpAuthContext } from "../../authz/context";
import type { IncomeRow } from "../../db/phase2Reads";
import { monthInput } from "../inputs";

export const incomeInput = monthInput;

export function incomeResult(
  ctx: McpAuthContext,
  month: string | null,
  list: (ctx: McpAuthContext, month: string | null) => Promise<IncomeRow[]>,
): Promise<IncomeRow[]> {
  return list(ctx, month);
}
