import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpenseRow, IncomeRow } from "./phase2Reads";

type Session = { userId: string; organizationId: string };

export type IncomeRecord = IncomeRow & { description: string | null };
export type ExpenseRecord = ExpenseRow & { description: string | null };

export type IncomeCreate = {
  transactionDate: string;
  amount: number;
  customerName: string | null;
  paymentMethod: string | null;
  description: string | null;
};

export type IncomeUpdate = {
  id: string;
  transactionDate: string | null;
  amount: number | null;
  customerName: string | null;
  paymentMethod: string | null;
  description: string | null;
};

export type ExpenseCreate = {
  expenseName: string;
  amount: number;
  createDate: string;
  expenseType: string;
  category: string;
  description: string | null;
};

export type ExpenseUpdate = {
  id: string;
  expenseName: string | null;
  amount: number | null;
  createDate: string | null;
  expenseType: string | null;
  category: string | null;
  description: string | null;
};

function asRows<T>(data: unknown): T[] {
  if (data == null) return [];
  return Array.isArray(data) ? (data as T[]) : [data as T];
}

async function callRpcOne<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  const row = asRows<T>(data)[0];
  if (!row) throw new Error("not_found");
  return row;
}

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

export function createIncomeTransaction(
  admin: SupabaseClient,
  ctx: Session,
  input: IncomeCreate,
): Promise<IncomeRecord> {
  return callRpcOne(admin, "mcp_create_income_transaction", {
    ...sessionArgs(ctx),
    p_transaction_date: input.transactionDate,
    p_amount: input.amount,
    p_customer_name: input.customerName,
    p_payment_method: input.paymentMethod,
    p_description: input.description,
  });
}

export function updateIncomeTransaction(
  admin: SupabaseClient,
  ctx: Session,
  input: IncomeUpdate,
): Promise<IncomeRecord> {
  return callRpcOne(admin, "mcp_update_income_transaction", {
    ...sessionArgs(ctx),
    p_id: input.id,
    p_transaction_date: input.transactionDate,
    p_amount: input.amount,
    p_customer_name: input.customerName,
    p_payment_method: input.paymentMethod,
    p_description: input.description,
  });
}

export function createExpenseRecord(
  admin: SupabaseClient,
  ctx: Session,
  input: ExpenseCreate,
): Promise<ExpenseRecord> {
  return callRpcOne(admin, "mcp_create_expense", {
    ...sessionArgs(ctx),
    p_expense_name: input.expenseName,
    p_amount: input.amount,
    p_create_date: input.createDate,
    p_expense_type: input.expenseType,
    p_category: input.category,
    p_description: input.description,
  });
}

export function updateExpenseRecord(
  admin: SupabaseClient,
  ctx: Session,
  input: ExpenseUpdate,
): Promise<ExpenseRecord> {
  return callRpcOne(admin, "mcp_update_expense", {
    ...sessionArgs(ctx),
    p_id: input.id,
    p_expense_name: input.expenseName,
    p_amount: input.amount,
    p_create_date: input.createDate,
    p_expense_type: input.expenseType,
    p_category: input.category,
    p_description: input.description,
  });
}
