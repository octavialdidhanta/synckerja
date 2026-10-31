import type { SupabaseClient } from "@supabase/supabase-js";

export type AdsAccountRow = {
  platform: string;
  label: string | null;
  account_id: string | null;
  is_active: boolean;
  last_test_ok: boolean | null;
  connected_at: string | null;
};

export type IncomeRow = {
  id: string;
  transaction_date: string;
  amount: number;
  customer_name: string | null;
  payment_method: string | null;
  status: string;
};

export type ExpenseRow = {
  id: string;
  expense_name: string;
  amount: number;
  expense_type: string;
  category: string;
  create_date: string;
  status: string;
};

export type EmployeeRow = {
  id: string;
  full_name: string;
  status: string | null;
  department_name: string | null;
  job_level_name: string | null;
};

export type VisitRow = {
  id: string;
  visit_date: string;
  status: string;
  match_status: string;
  lookup_kind: string;
  client_name: string | null;
};

export type KolCampaignRow = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  total_budget: number | null;
  allocated_budget: number | null;
  remaining_budget: number | null;
};

export type KolProfileRow = {
  id: string;
  name: string;
  status: string;
  category: string | null;
  followers_count: number | null;
  engagement_rate: number | null;
};

export type StockRow = {
  id: string;
  product_name: string;
  sku_name: string;
  internal_sku: string;
  available_qty: number;
  reserved_qty: number;
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

export function listAdsAccounts(admin: SupabaseClient, ctx: Session): Promise<AdsAccountRow[]> {
  return callRpc(admin, "mcp_list_ads_accounts", sessionArgs(ctx));
}

export function listIncomeTransactions(
  admin: SupabaseClient,
  ctx: Session,
  month: string | null,
): Promise<IncomeRow[]> {
  return callRpc(admin, "mcp_list_income_transactions", { ...sessionArgs(ctx), p_month: month });
}

export function listExpenses(admin: SupabaseClient, ctx: Session, month: string | null): Promise<ExpenseRow[]> {
  return callRpc(admin, "mcp_list_expenses", { ...sessionArgs(ctx), p_month: month });
}

export function listEmployees(admin: SupabaseClient, ctx: Session): Promise<EmployeeRow[]> {
  return callRpc(admin, "mcp_list_employees", sessionArgs(ctx));
}

export function listCustomerVisits(admin: SupabaseClient, ctx: Session, month: string | null): Promise<VisitRow[]> {
  return callRpc(admin, "mcp_list_customer_visits", { ...sessionArgs(ctx), p_month: month });
}

export function listKolCampaigns(admin: SupabaseClient, ctx: Session): Promise<KolCampaignRow[]> {
  return callRpc(admin, "mcp_list_kol_campaigns", sessionArgs(ctx));
}

export function listKolProfiles(admin: SupabaseClient, ctx: Session): Promise<KolProfileRow[]> {
  return callRpc(admin, "mcp_list_kol_profiles", sessionArgs(ctx));
}

export function listInventoryStock(admin: SupabaseClient, ctx: Session): Promise<StockRow[]> {
  return callRpc(admin, "mcp_list_inventory_stock", sessionArgs(ctx));
}
