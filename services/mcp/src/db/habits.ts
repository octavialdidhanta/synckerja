import type { SupabaseClient } from "@supabase/supabase-js";

type Session = { userId: string; organizationId: string };

export type HabitChecklistItem = {
  index: number;
  name: string;
  checked: boolean;
};

export type HabitDayRow = {
  id: string;
  name: string;
  frequency: string;
  target_count: number;
  items: HabitChecklistItem[];
};

export type HabitCheckResult = {
  id: string;
  entry_date: string;
  item_index: number;
  checked: boolean;
  checked_count: number;
  target_count: number;
};

export type HabitCheckInput = {
  habitId: string;
  checked: boolean;
  date: string | null;
  index: number | null;
};

async function callRpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  if (data == null) return [];
  return (Array.isArray(data) ? data : [data]) as T[];
}

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

export async function listHabits(
  admin: SupabaseClient,
  ctx: Session,
  date: string | null,
): Promise<HabitDayRow[]> {
  return callRpc(admin, "mcp_list_habits", { ...sessionArgs(ctx), p_date: date });
}

export async function checkHabit(
  admin: SupabaseClient,
  ctx: Session,
  input: HabitCheckInput,
): Promise<HabitCheckResult> {
  const rows = await callRpc<HabitCheckResult>(admin, "mcp_check_habit", {
    ...sessionArgs(ctx),
    p_habit_id: input.habitId,
    p_checked: input.checked,
    p_date: input.date,
    p_index: input.index,
  });
  const row = rows[0];
  if (!row) throw new Error("not_found");
  return row;
}
