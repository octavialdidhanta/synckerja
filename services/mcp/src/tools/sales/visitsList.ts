import type { McpAuthContext } from "../../authz/context";
import type { VisitRow } from "../../db/phase2Reads";
import { monthInput } from "../inputs";

export const visitsInput = monthInput;

export function visitsResult(
  ctx: McpAuthContext,
  month: string | null,
  list: (ctx: McpAuthContext, month: string | null) => Promise<VisitRow[]>,
): Promise<VisitRow[]> {
  return list(ctx, month);
}
