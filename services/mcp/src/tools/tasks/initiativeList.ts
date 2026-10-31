import type { McpAuthContext } from "../../authz/context";
import type { InitiativeRow } from "../../db/dailyTasks";
import { emptyInput } from "../inputs";

export const taskInitiativeInput = emptyInput;

export function taskInitiativeResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<InitiativeRow[]>,
): Promise<InitiativeRow[]> {
  return list(ctx);
}
