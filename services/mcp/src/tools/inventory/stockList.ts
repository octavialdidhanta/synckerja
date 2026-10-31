import type { McpAuthContext } from "../../authz/context";
import type { StockRow } from "../../db/phase2Reads";
import { emptyInput } from "../inputs";

export const stockInput = emptyInput;

export function stockResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<StockRow[]>,
): Promise<StockRow[]> {
  return list(ctx);
}
