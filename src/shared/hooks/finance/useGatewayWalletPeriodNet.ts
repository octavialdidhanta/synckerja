import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';

export type GatewayPeriodNet = {
  income: number;
  expense: number;
  net: number;
};

function inRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export function useGatewayWalletPeriodNet(startDate: Date, endDate: Date, enabled: boolean) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['gateway-wallet-period-net', organizationId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!organizationId) {
        return { brick: { income: 0, expense: 0, net: 0 }, xendit: { income: 0, expense: 0, net: 0 } };
      }

      const [brickVaRes, brickDisbRes, xenditVaRes, xenditDisbRes, settledIncomeRes] = await Promise.all([
        supabase
          .from('brick_payment_requests')
          .select('expected_amount, completed_at, paid_at, sales_activity_payment_id')
          .eq('organization_id', organizationId)
          .in('status', ['completed', 'paid']),
        supabase
          .from('brick_disbursements')
          .select('amount, completed_at')
          .eq('organization_id', organizationId)
          .eq('status', 'completed'),
        supabase
          .from('xendit_payment_requests')
          .select('expected_amount, paid_at, sales_activity_payment_id')
          .eq('organization_id', organizationId)
          .eq('status', 'paid'),
        supabase
          .from('xendit_disbursements')
          .select('amount, completed_at')
          .eq('organization_id', organizationId)
          .eq('status', 'completed'),
        supabase
          .from('income_transactions')
          .select('sales_activity_payment_id')
          .eq('organization_id', organizationId)
          .eq('status', 'completed')
          .not('sales_activity_payment_id', 'is', null),
      ]);

      if (brickVaRes.error) throw brickVaRes.error;
      if (brickDisbRes.error) throw brickDisbRes.error;
      if (xenditVaRes.error) throw xenditVaRes.error;
      if (xenditDisbRes.error) throw xenditDisbRes.error;
      if (settledIncomeRes.error) throw settledIncomeRes.error;

      const settledSapIds = new Set(
        (settledIncomeRes.data ?? [])
          .map((row) => row.sales_activity_payment_id)
          .filter((id): id is string => Boolean(id)),
      );

      const brickIncome = (brickVaRes.data ?? [])
        .filter(
          (r) =>
            inRange(r.completed_at ?? r.paid_at, startDate, endDate) &&
            !settledSapIds.has(r.sales_activity_payment_id),
        )
        .reduce((sum, r) => sum + Number(r.expected_amount ?? 0), 0);
      const brickExpense = (brickDisbRes.data ?? [])
        .filter((r) => inRange(r.completed_at, startDate, endDate))
        .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

      const xenditIncome = (xenditVaRes.data ?? [])
        .filter(
          (r) =>
            inRange(r.paid_at, startDate, endDate) && !settledSapIds.has(r.sales_activity_payment_id),
        )
        .reduce((sum, r) => sum + Number(r.expected_amount ?? 0), 0);
      const xenditExpense = (xenditDisbRes.data ?? [])
        .filter((r) => inRange(r.completed_at, startDate, endDate))
        .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

      return {
        brick: { income: brickIncome, expense: brickExpense, net: brickIncome - brickExpense },
        xendit: { income: xenditIncome, expense: xenditExpense, net: xenditIncome - xenditExpense },
      };
    },
    enabled: Boolean(organizationId) && enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
