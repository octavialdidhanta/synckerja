import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface DebtPaymentRecord {
  id: string;
  debt_id: string;
  payment_amount: number;
  payment_date: string;
  payment_method: string | null;
  notes: string | null;
  transaction_reference: string | null;
  principal_amount: number | null;
  interest_amount: number | null;
  created_at: string;
  bank_account_name?: string | null;
}

export const useDebtPayments = (debtId: string | null) => {
  const { organizationId } = useCurrentOrg();

  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ['debt-payments', organizationId, debtId],
    queryFn: async (): Promise<DebtPaymentRecord[]> => {
      if (!organizationId || !debtId) return [];
      const { data, error } = await supabase
        .from('debt_payments')
        .select(
          'id, debt_id, payment_amount, payment_date, payment_method, notes, transaction_reference, principal_amount, interest_amount, created_at'
        )
        .eq('organization_id', organizationId)
        .eq('debt_id', debtId)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = data || [];
      const methodIds = [...new Set(rows.map((r: any) => r.payment_method).filter(Boolean))] as string[];
      let methodNames: Record<string, string> = {};
      if (methodIds.length > 0) {
        const { data: accounts } = await supabase
          .from('bank_accounts')
          .select('id, name, account_number')
          .eq('organization_id', organizationId)
          .in('id', methodIds);
        (accounts || []).forEach((acc: { id: string; name: string; account_number: string | null }) => {
          const label = acc.account_number ? `${acc.name} - ${acc.account_number}` : acc.name;
          methodNames[acc.id] = label;
        });
      }
      const list = rows.map((row: any) => ({
        id: row.id,
        debt_id: row.debt_id,
        payment_amount: row.payment_amount,
        payment_date: row.payment_date,
        payment_method: row.payment_method,
        notes: row.notes,
        transaction_reference: row.transaction_reference ?? null,
        principal_amount: row.principal_amount ?? null,
        interest_amount: row.interest_amount ?? null,
        created_at: row.created_at,
        bank_account_name: row.payment_method ? (methodNames[row.payment_method] ?? null) : null,
      }));
      return list;
    },
    enabled: !!organizationId && !!debtId,
  });

  return { payments, isLoading, refetch };
};
