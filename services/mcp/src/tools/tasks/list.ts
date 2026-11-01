import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskListRow } from "../../db/dailyTasks";
import { taskPlanMonth, taskStatus } from "./fields";

export const taskListInput = z.object({
  status: taskStatus.optional(),
  month: taskPlanMonth.optional(),
}).strict();

export function taskListResult(
  ctx: McpAuthContext,
  status: string | null,
  month: string | null,
  list: (ctx: McpAuthContext, status: string | null, month: string | null) => Promise<TaskListRow[]>,
): Promise<TaskListRow[]> {
  return list(ctx, status, month);
}
