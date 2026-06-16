import { supabase } from "@/shared/lib/supabaseClient";

export type IncomeTransactionSummaryRow = {
  amount: number | string;
  status: string;
  transaction_date: string;
};

export const incomeTransactionSummaryQueryKey = (organizationId?: string | null) =>
  ["income-transaction-summary", organizationId] as const;

export async function fetchIncomeTransactionSummary(
  organizationId: string,
): Promise<IncomeTransactionSummaryRow[]> {
  const { data, error } = await supabase
    .from("income_transactions")
    .select("amount, status, transaction_date")
    .eq("organization_id", organizationId)
    .eq("status", "completed");

  if (error) throw error;
  return data ?? [];
}

export function computeIncomeMetricsFromSummary(rows: IncomeTransactionSummaryRow[]) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const pad = (m: number) => m.toString().padStart(2, "0");
  const currentMonthStart = `${currentYear}-${pad(currentMonth)}-01`;
  const currentMonthEndStr =
    currentMonth === 12
      ? `${currentYear + 1}-01-01`
      : `${currentYear}-${pad(currentMonth + 1)}-01`;

  const previousMonthStart = `${previousYear}-${pad(previousMonth)}-01`;
  const previousMonthEnd = `${previousYear}-${pad(currentMonth)}-01`;

  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear + 1}-01-01`;

  let currentMonthTotal = 0;
  let previousMonthTotal = 0;
  let yearTotal = 0;
  let currentMonthTransactionCount = 0;

  for (const row of rows) {
    const amount = parseFloat(String(row.amount));
    const date = row.transaction_date;
    if (date >= currentMonthStart && date < currentMonthEndStr) {
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

export function computeMonthlyIncomeDataFromSummary(
  rows: IncomeTransactionSummaryRow[],
  selectedYear: string,
) {
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  const monthlyData = months.map((month) => ({
    month: `${month} ${selectedYear}`,
    shortMonth: month,
    value: 0,
    count: 0,
  }));

  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${parseInt(selectedYear, 10) + 1}-01-01`;

  for (const row of rows) {
    const date = row.transaction_date;
    if (date < yearStart || date >= yearEnd) continue;

    const monthIndex = new Date(date).getMonth();
    const amount = parseFloat(String(row.amount));
    monthlyData[monthIndex].value += amount;
    monthlyData[monthIndex].count += 1;
  }

  return monthlyData.map((item) => ({
    ...item,
    label: item.value > 0 ? `Rp${(item.value / 1000000).toFixed(1)}M` : "Rp0",
  }));
}
