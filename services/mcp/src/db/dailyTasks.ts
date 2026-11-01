import type { SupabaseClient } from "@supabase/supabase-js";

type Session = { userId: string; organizationId: string };

export type TaskSummary = {
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  overdue: number;
};

export type TaskListRow = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  assignee_name: string | null;
  creator_name: string | null;
};

export type InitiativeRow = {
  id: string;
  level: string;
  title: string;
  task_title: string;
  priority: string | null;
  due_date: string | null;
  assignee_name: string | null;
};

export type WorkloadRow = {
  employee_id: string;
  full_name: string;
  active_count: number;
  idle: boolean;
  pending_days: number;
};

export type CompletedStepRow = {
  id: string;
  task_title: string;
  step_title: string;
  completed_at: string | null;
  assignee_name: string | null;
};

export type TaskRecord = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
};

export type AssignTaskResult = {
  id: string;
  assignee_name: string | null;
  due_date: string | null;
};

export type TakeInitiativeResult = {
  id: string;
  level: string;
  assignee_name: string | null;
  due_date: string | null;
};

export type CreateTaskInput = {
  title: string;
  description: string | null;
  priority: string | null;
  dueDate: string | null;
  employeeId: string | null;
};

export type UpdateTaskInput = {
  id: string;
  title: string | null;
  priority: string | null;
  dueDate: string | null;
};

export type AssignTaskInput = {
  id: string;
  employeeId: string;
  dueDate: string | null;
};

export type TakeInitiativeInput = {
  id: string;
  level: string;
  dueDate: string;
  employeeId: string | null;
};

function asRows<T>(data: unknown): T[] {
  if (data == null) return [];
  return Array.isArray(data) ? (data as T[]) : [data as T];
}

async function callRpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return asRows<T>(data);
}

async function callRpcOne<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const rows = await callRpc<T>(admin, fn, args);
  const row = rows[0];
  if (!row) throw new Error("not_found");
  return row;
}

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

export function listTaskSummary(
  admin: SupabaseClient,
  ctx: Session,
  month: string | null,
): Promise<TaskSummary> {
  return callRpcOne(admin, "mcp_task_summary", { ...sessionArgs(ctx), p_month: month });
}

export function listTasks(
  admin: SupabaseClient,
  ctx: Session,
  status: string | null,
): Promise<TaskListRow[]> {
  return callRpc(admin, "mcp_list_tasks", { ...sessionArgs(ctx), p_status: status });
}

export function listTaskInitiative(admin: SupabaseClient, ctx: Session): Promise<InitiativeRow[]> {
  return callRpc(admin, "mcp_list_task_initiative", sessionArgs(ctx));
}

export function listTaskWorkload(
  admin: SupabaseClient,
  ctx: Session,
  timeframe: string | null,
): Promise<WorkloadRow[]> {
  return callRpc(admin, "mcp_task_workload", { ...sessionArgs(ctx), p_timeframe: timeframe });
}

export function listCompletedSteps(
  admin: SupabaseClient,
  ctx: Session,
  month: string | null,
): Promise<CompletedStepRow[]> {
  return callRpc(admin, "mcp_list_completed_steps", { ...sessionArgs(ctx), p_month: month });
}

export function createTask(
  admin: SupabaseClient,
  ctx: Session,
  input: CreateTaskInput,
): Promise<TaskRecord> {
  return callRpcOne(admin, "mcp_create_task", {
    ...sessionArgs(ctx),
    p_title: input.title,
    p_description: input.description,
    p_priority: input.priority,
    p_due_date: input.dueDate,
    p_employee_id: input.employeeId,
  });
}

export function updateTask(
  admin: SupabaseClient,
  ctx: Session,
  input: UpdateTaskInput,
): Promise<TaskRecord> {
  return callRpcOne(admin, "mcp_update_task", {
    ...sessionArgs(ctx),
    p_id: input.id,
    p_title: input.title,
    p_priority: input.priority,
    p_due_date: input.dueDate,
  });
}

export type TaskObjectiveLink = {
  id: string;
  title: string;
  objective_id: string;
};

export function linkTaskObjective(
  admin: SupabaseClient,
  ctx: Session,
  input: { taskId: string; individualObjectiveId: string },
): Promise<TaskObjectiveLink> {
  return callRpcOne(admin, "mcp_link_task_objective", {
    ...sessionArgs(ctx),
    p_task_id: input.taskId,
    p_individual_objective_id: input.individualObjectiveId,
  });
}

export function deleteTask(admin: SupabaseClient, ctx: Session, id: string): Promise<{ id: string }> {
  return callRpcOne(admin, "mcp_delete_task", { ...sessionArgs(ctx), p_id: id });
}

export function assignTask(
  admin: SupabaseClient,
  ctx: Session,
  input: AssignTaskInput,
): Promise<AssignTaskResult> {
  return callRpcOne(admin, "mcp_assign_task", {
    ...sessionArgs(ctx),
    p_id: input.id,
    p_employee_id: input.employeeId,
    p_due_date: input.dueDate,
  });
}

export type TaskStepRow = {
  id: string;
  title: string;
  order: number;
  is_completed: boolean;
  assignee_name: string | null;
};

export type TaskStepRecord = {
  id: string;
  title: string;
  order: number;
  is_completed: boolean;
};

type StepRpcRow = {
  id: string;
  title: string;
  step_order: number;
  is_completed: boolean;
  assignee_name?: string | null;
};

function asStep(row: StepRpcRow): TaskStepRecord {
  return {
    id: row.id,
    title: row.title,
    order: row.step_order,
    is_completed: row.is_completed,
  };
}

export function listTaskSteps(
  admin: SupabaseClient,
  ctx: Session,
  taskId: string,
): Promise<TaskStepRow[]> {
  return callRpc<StepRpcRow>(admin, "mcp_list_task_steps", { ...sessionArgs(ctx), p_task_id: taskId }).then((rows) =>
    rows.map((row) => ({ ...asStep(row), assignee_name: row.assignee_name ?? null })),
  );
}

export function createTaskStep(
  admin: SupabaseClient,
  ctx: Session,
  input: { taskId: string; title: string; description: string | null },
): Promise<TaskStepRecord> {
  return callRpcOne<StepRpcRow>(admin, "mcp_create_task_step", {
    ...sessionArgs(ctx),
    p_task_id: input.taskId,
    p_title: input.title,
    p_description: input.description,
  }).then(asStep);
}

export function updateTaskStep(
  admin: SupabaseClient,
  ctx: Session,
  input: { id: string; title: string },
): Promise<TaskStepRecord> {
  return callRpcOne<StepRpcRow>(admin, "mcp_update_task_step", {
    ...sessionArgs(ctx),
    p_id: input.id,
    p_title: input.title,
  }).then(asStep);
}

export function deleteTaskStep(admin: SupabaseClient, ctx: Session, id: string): Promise<{ id: string }> {
  return callRpcOne(admin, "mcp_delete_task_step", { ...sessionArgs(ctx), p_id: id });
}

export function takeTaskInitiative(
  admin: SupabaseClient,
  ctx: Session,
  input: TakeInitiativeInput,
): Promise<TakeInitiativeResult> {
  return callRpcOne(admin, "mcp_take_task_initiative", {
    ...sessionArgs(ctx),
    p_id: input.id,
    p_level: input.level,
    p_due_date: input.dueDate,
    p_employee_id: input.employeeId,
  });
}
