import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskListRow } from "../../db/dailyTasks";
import { taskListMonth, taskStatus } from "./fields";

export const taskListInput = z.object({
  status: taskStatus.optional(),
  month: taskListMonth.optional(),
}).strict();

export function taskListResult(
  ctx: McpAuthContext,
  status: string | null,
  month: string | null,
  list: (ctx: McpAuthContext, status: string | null, month: string | null) => Promise<TaskListRow[]>,
): Promise<TaskListRow[]> {
  return list(ctx, status, month);
}
