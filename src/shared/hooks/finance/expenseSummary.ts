import { supabase } from "@/shared/lib/supabaseClient";

export type ExpenseSummaryRow = {
  amount: number | string;
  create_date: string;
};

export async function fetchExpenseSummaryRows(organizationId: string): Promise<ExpenseSummaryRow[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("amount, create_date")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (error) throw error;
  return data ?? [];
}

export function computeExpenseMetricsFromSummary(rows: ExpenseSummaryRow[]) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const pad = (m: number) => m.toString().padStart(2, "0");
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  const prevNextMonth = previousMonth === 12 ? 1 : previousMonth + 1;
  const prevNextMonthYear = previousMonth === 12 ? previousYear + 1 : previousYear;

  const currentMonthStart = `${currentYear}-${pad(currentMonth)}-01`;
  const currentMonthEnd = `${nextMonthYear}-${pad(nextMonth)}-01`;
  const previousMonthStart = `${previousYear}-${pad(previousMonth)}-01`;
  const previousMonthEnd = `${prevNextMonthYear}-${pad(prevNextMonth)}-01`;
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear + 1}-01-01`;

  let currentMonthTotal = 0;
  let previousMonthTotal = 0;
  let yearTotal = 0;
  let currentMonthTransactionCount = 0;

  for (const row of rows) {
    const amount = parseFloat(String(row.amount));
    const date = row.create_date;
    if (date >= currentMonthStart && date < currentMonthEnd) {
      currentMonthTotal += amount;
      currentMonthTransactionCount += 1;
    }
    if (date >= previousMonthStart && date < previousMonthEnd) {
      previousMonthTotal += amount;
    }
    if (date >= yearStart && date < yearEnd) {
      yearTotal += amount;
    }
  }

  const growthPercentage =
    previousMonthTotal > 0
      ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
      : currentMonthTotal > 0
        ? 100
        : 0;

  return {
    currentMonthTotal,
    previousMonthTotal,
    yearTotal,
    totalTransactions: rows.length,
    growthPercentage,
    currentMonthTransactionCount,
  };
}
