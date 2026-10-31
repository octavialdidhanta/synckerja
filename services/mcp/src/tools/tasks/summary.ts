import type { McpAuthContext } from "../../authz/context";
import type { TaskSummary } from "../../db/dailyTasks";
import { monthInput } from "../inputs";

export const taskSummaryInput = monthInput;

export function taskSummaryResult(
  ctx: McpAuthContext,
  month: string | null,
  list: (ctx: McpAuthContext, month: string | null) => Promise<TaskSummary>,
): Promise<TaskSummary> {
  return list(ctx, month);
}
