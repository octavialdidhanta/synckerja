import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PayrollRunThpTotal = {
  amount: number;
  employee_count: number;
};

export async function computePayrollRunThpTotal(
  admin: SupabaseClient,
  runId: string,
): Promise<PayrollRunThpTotal> {
  const { data, error } = await admin
    .from("employee_payroll_calculations")
    .select("take_home_pay")
    .eq("payroll_run_id", runId)
    .eq("payment_status", "paid");

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  let amount = 0;
  for (const row of rows) {
    amount += Number((row as { take_home_pay?: number }).take_home_pay) || 0;
  }

  return { amount, employee_count: rows.length };
}
