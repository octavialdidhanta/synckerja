import type { SupabaseClient } from "@supabase/supabase-js";

export type PayrollRunRow = {
  id: string;
  run_name: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: string;
  total_employees: number | null;
  total_net_pay: number | null;
};

export type PosDailySalesRow = {
  sale_date: string;
  transaction_count: number;
  total_sales: number;
};

type Session = { userId: string; organizationId: string };

async function callRpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

export function listPayrollRuns(
  admin: SupabaseClient,
  ctx: Session,
  month: string | null,
): Promise<PayrollRunRow[]> {
  return callRpc(admin, "mcp_list_payroll_runs", { ...sessionArgs(ctx), p_month: month });
}

export function listPosDailySales(
  admin: SupabaseClient,
  ctx: Session,
  month: string | null,
): Promise<PosDailySalesRow[]> {
  return callRpc(admin, "mcp_list_pos_daily_sales", { ...sessionArgs(ctx), p_month: month });
}
