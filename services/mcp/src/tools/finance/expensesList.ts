import type { McpAuthContext } from "../../authz/context";
import type { ExpenseRow } from "../../db/phase2Reads";
import { monthInput } from "../inputs";

export const expensesInput = monthInput;

export function expensesResult(
  ctx: McpAuthContext,
  month: string | null,
  list: (ctx: McpAuthContext, month: string | null) => Promise<ExpenseRow[]>,
): Promise<ExpenseRow[]> {
  return list(ctx, month);
}
