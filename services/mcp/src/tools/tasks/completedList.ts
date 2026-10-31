import type { McpAuthContext } from "../../authz/context";
import type { CompletedStepRow } from "../../db/dailyTasks";
import { monthInput } from "../inputs";

export const completedStepsInput = monthInput;

export function completedStepsResult(
  ctx: McpAuthContext,
  month: string | null,
  list: (ctx: McpAuthContext, month: string | null) => Promise<CompletedStepRow[]>,
): Promise<CompletedStepRow[]> {
  return list(ctx, month);
}
