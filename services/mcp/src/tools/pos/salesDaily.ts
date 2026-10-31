import type { McpAuthContext } from "../../authz/context";
import type { PosDailySalesRow } from "../../db/payrollPosReads";
import { monthInput } from "../inputs";

export const posDailyInput = monthInput;

export function posDailyResult(
  ctx: McpAuthContext,
  month: string | null,
  list: (ctx: McpAuthContext, month: string | null) => Promise<PosDailySalesRow[]>,
): Promise<PosDailySalesRow[]> {
  return list(ctx, month);
}
