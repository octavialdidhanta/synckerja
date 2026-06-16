import type { QueryClient } from '@tanstack/react-query';
import { EXPENSES_QUERY_KEY } from '@/shared/lib/expensesQueryKeys';

/**
 * Marks income-related caches stale so they refetch when needed — including routes that are
 * **not** currently mounted (unlike `refetchQueries` default, which only hits active queries).
 * Use after payment ↔ income sync from `PaymentUpdateModal` or income delete from dashboard.
 */
export async function refetchIncomeModuleQueries(
  queryClient: QueryClient,
  _organizationId: string | null | undefined,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['income-transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['sales-activities'] }),
    queryClient.invalidateQueries({ queryKey: ['bank-account-balances'] }),
    queryClient.invalidateQueries({ queryKey: [...EXPENSES_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: ['income-transaction-summary'] }),
    queryClient.invalidateQueries({ queryKey: ['income-metrics'] }),
    queryClient.invalidateQueries({ queryKey: ['monthly-income-data'] }),
    queryClient.invalidateQueries({ queryKey: ['expense-metrics'] }),
  ]);
}
