import { supabase } from "@/shared/lib/supabaseClient";
import type { Debt } from "@/shared/types/debt";

export const ORGANIZATION_DEBTS_QUERY_KEY = (organizationId: string) =>
  ["organization-debts", organizationId] as const;

export type OrganizationDebtsQueryData = {
  debts: Debt[];
  totalInterestYtd: number;
};

export async function fetchOrganizationDebts(organizationId: string): Promise<OrganizationDebtsQueryData> {
  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const debtList = (data || []) as Debt[];
  const debtIds = debtList.map((d) => d.id);

  const totalInterestByDebt: Record<string, number> = {};
  const lastPaymentByDebt: Record<string, string> = {};
  const startOfYear = `${new Date().getFullYear()}-01-01`;
  let ytdInterest = 0;

  if (debtIds.length > 0) {
    const { data: payments } = await supabase
      .from("debt_payments")
      .select("debt_id, interest_amount, payment_date")
      .eq("organization_id", organizationId)
      .in("debt_id", debtIds);

    (payments || []).forEach((p: { debt_id: string; interest_amount: number | null; payment_date: string }) => {
      const amt = p.interest_amount ?? 0;
      totalInterestByDebt[p.debt_id] = (totalInterestByDebt[p.debt_id] ?? 0) + amt;
      const d = p.payment_date;
      if (d && (!lastPaymentByDebt[p.debt_id] || d > lastPaymentByDebt[p.debt_id])) {
        lastPaymentByDebt[p.debt_id] = d;
      }
      if (d && d >= startOfYear) {
        ytdInterest += amt;
      }
    });
  }

  const merged = debtList.map((d) => ({
    ...d,
    total_interest: totalInterestByDebt[d.id] ?? 0,
    last_payment_date: lastPaymentByDebt[d.id] ?? null,
  }));

  return { debts: merged, totalInterestYtd: ytdInterest };
}
