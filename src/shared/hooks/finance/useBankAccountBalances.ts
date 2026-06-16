import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
const LEDGER_PAGE_SIZE = 1000;

async function fetchPaginatedRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + LEDGER_PAGE_SIZE - 1);
    if (error) throw error;
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < LEDGER_PAGE_SIZE) break;
    from += LEDGER_PAGE_SIZE;
  }
  return rows;
}

export interface BankAccountBalance {
  id: string;
  bank_account_id: string;
  organization_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
  bank_account?: {
    id: string;
    name: string;
    account_number: string | null;
    bank_name: string | null;
  };
}

export interface BankAccountBalanceHistory {
  id: string;
  bank_account_id: string;
  organization_id: string;
  transaction_type: 'income' | 'expense' | 'manual_adjustment' | 'initial' | 'gateway_withdrawal';
  transaction_id: string | null;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export const useBankAccountBalances = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: balances = [], isLoading: loading, isPending, refetch } = useQuery({
    queryKey: ['bank-account-balances', organizationId],
    staleTime: 60_000,
    queryFn: async () => {
      if (!organizationId) return [];

      const { data: bankAccounts, error: bankAccountsError } = await supabase
        .from('bank_accounts')
        .select('id, name, account_number, bank_name')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (bankAccountsError) {
        console.error('Error fetching bank accounts:', bankAccountsError);
        throw bankAccountsError;
      }

      const { data: storedBalances, error: balancesError } = await supabase
        .from('bank_account_balances')
        .select('*')
        .eq('organization_id', organizationId);

      if (balancesError) {
        console.error('Error fetching bank account balances:', balancesError);
        throw balancesError;
      }

      const ids = (bankAccounts || []).map((a: { id: string }) => a.id);
      if (ids.length === 0) return [];

      const ledgerByAccount: Record<string, number> = {};
      for (const id of ids) ledgerByAccount[id] = 0;

      const idList = ids.join(',');
      const transferFilter = `from_bank_account_id.in.(${idList}),to_bank_account_id.in.(${idList})`;

      const [incomeRows, expenseRows, transferRows, debtPaymentRows, gatewayWithdrawalRows] =
        await Promise.all([
          fetchPaginatedRows<{ bank_account_id: string | null; amount: unknown }>((from, to) =>
            supabase
              .from('income_transactions')
              .select('bank_account_id, amount')
              .eq('organization_id', organizationId)
              .in('bank_account_id', ids)
              .in('status', ['completed', 'pending'])
              .range(from, to),
          ),
          fetchPaginatedRows<{ bank_account_id: string | null; amount: unknown }>((from, to) =>
            supabase
              .from('expenses')
              .select('bank_account_id, amount')
              .eq('organization_id', organizationId)
              .in('bank_account_id', ids)
              .eq('status', 'active')
              .range(from, to),
          ),
          fetchPaginatedRows<{
            from_bank_account_id: string;
            to_bank_account_id: string;
            amount: unknown;
          }>((from, to) =>
            supabase
              .from('bank_transfer_journals')
              .select('from_bank_account_id, to_bank_account_id, amount')
              .eq('organization_id', organizationId)
              .is('income_transaction_id', null)
              .or(transferFilter)
              .range(from, to),
          ),
          fetchPaginatedRows<{ payment_method: string | null; payment_amount: unknown }>((from, to) =>
            supabase
              .from('debt_payments')
              .select('payment_method, payment_amount')
              .eq('organization_id', organizationId)
              .in('payment_method', ids)
              .range(from, to),
          ),
          fetchPaginatedRows<{ bank_account_id: string; amount: unknown }>((from, to) =>
            supabase
              .from('bank_account_balance_history')
              .select('bank_account_id, amount')
              .eq('organization_id', organizationId)
              .eq('transaction_type', 'gateway_withdrawal')
              .in('bank_account_id', ids)
              .range(from, to),
          ),
        ]);

      for (const row of incomeRows) {
        const bid = row.bank_account_id as string | null;
        if (bid && bid in ledgerByAccount) {
          ledgerByAccount[bid] += parseFloat(String(row.amount));
        }
      }
      for (const row of expenseRows) {
        const bid = row.bank_account_id as string | null;
        if (bid && bid in ledgerByAccount) {
          ledgerByAccount[bid] -= parseFloat(String(row.amount));
        }
      }

      for (const row of transferRows) {
        const fromId = row.from_bank_account_id;
        const toId = row.to_bank_account_id;
        const amt = parseFloat(String(row.amount ?? 0));
        if (!Number.isFinite(amt)) continue;
        if (fromId && fromId in ledgerByAccount) {
          ledgerByAccount[fromId] -= amt;
        }
        if (toId && toId in ledgerByAccount) {
          ledgerByAccount[toId] += amt;
        }
      }

      // Debt payments debit `payment_method` via `updateBalance` on `bank_account_balances`.
      // Displayed balance is this ledger (income − expense ± transfers ± gateway withdrawals), not the stored column,
      // so outflows must include `debt_payments` or saldo looks unchanged after Pay Debt.
      for (const row of debtPaymentRows) {
        const bid = row.payment_method as string | null;
        if (!bid || !(bid in ledgerByAccount)) continue;
        const amt = parseFloat(String(row.payment_amount ?? 0));
        if (!Number.isFinite(amt) || amt <= 0) continue;
        ledgerByAccount[bid] -= amt;
      }

      // Gateway withdrawal settlement credits payout bank via balance history, not income_transactions.
      for (const row of gatewayWithdrawalRows) {
        const bid = row.bank_account_id as string;
        if (!(bid in ledgerByAccount)) continue;
        const amt = parseFloat(String(row.amount ?? 0));
        if (!Number.isFinite(amt) || amt <= 0) continue;
        ledgerByAccount[bid] += amt;
      }

      return (bankAccounts || []).map((bankAccount: { id: string; name: string; account_number: string | null; bank_name: string | null }) => {
        const storedBalance = storedBalances?.find((b) => b.bank_account_id === bankAccount.id);
        const ledger = ledgerByAccount[bankAccount.id] ?? 0;

        if (storedBalance) {
          return {
            id: storedBalance.id,
            bank_account_id: bankAccount.id,
            organization_id: organizationId,
            balance: ledger,
            created_at: storedBalance.created_at,
            updated_at: storedBalance.updated_at,
            bank_account: bankAccount,
          } as BankAccountBalance;
        }

        return {
          id: `temp-${bankAccount.id}`,
          bank_account_id: bankAccount.id,
          organization_id: organizationId,
          balance: ledger,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          bank_account: bankAccount,
        } as BankAccountBalance;
      });
    },
    enabled: !!organizationId,
  });

  const getOrCreateBalance = async (bankAccountId: string): Promise<BankAccountBalance> => {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data: existingBalance, error: fetchError } = await supabase
      .from('bank_account_balances')
      .select('*')
      .eq('bank_account_id', bankAccountId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existingBalance) {
      return {
        ...existingBalance,
        balance: parseFloat(existingBalance.balance.toString()),
      } as BankAccountBalance;
    }

    const { data: newBalance, error: createError } = await supabase
      .from('bank_account_balances')
      .insert({
        bank_account_id: bankAccountId,
        organization_id: organizationId,
        balance: 0,
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('bank_account_balance_history').insert({
      bank_account_id: bankAccountId,
      organization_id: organizationId,
      transaction_type: 'initial',
      amount: 0,
      balance_before: 0,
      balance_after: 0,
      description: 'Initial balance',
      created_by: userData?.user?.id || null,
    });

    return {
      ...newBalance,
      balance: parseFloat(newBalance.balance.toString()),
    } as BankAccountBalance;
  };

  const updateBalance = async (
    bankAccountId: string,
    amount: number,
    transactionType: 'income' | 'expense' | 'manual_adjustment',
    transactionId?: string,
    description?: string
  ): Promise<void> => {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const currentBalance = await getOrCreateBalance(bankAccountId);
    const ledgerBalance = balances.find((b) => b.bank_account_id === bankAccountId)?.balance;
    const balanceBefore =
      typeof ledgerBalance === 'number' && Number.isFinite(ledgerBalance)
        ? ledgerBalance
        : currentBalance.balance;
    const balanceAfter = balanceBefore + amount;

    if (transactionType === 'expense' && balanceAfter < 0) {
      throw new Error(`Insufficient balance. Available: ${balanceBefore}, Required: ${Math.abs(amount)}`);
    }

    const { error: updateError } = await supabase
      .from('bank_account_balances')
      .update({
        balance: balanceAfter,
        updated_at: new Date().toISOString(),
      })
      .eq('bank_account_id', bankAccountId)
      .eq('organization_id', organizationId);

    if (updateError) {
      throw updateError;
    }

    const { error: historyError } = await supabase.from('bank_account_balance_history').insert({
      bank_account_id: bankAccountId,
      organization_id: organizationId,
      transaction_type: transactionType,
      transaction_id: transactionId || null,
      amount: amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: description || null,
      created_by: userId || null,
    });

    if (historyError) {
      console.error('Error creating balance history:', historyError);
    }

    queryClient.invalidateQueries({ queryKey: ['bank-account-balances', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['bank-account-balance-history', bankAccountId] });
  };

  const getBalanceHistory = async (bankAccountId: string): Promise<BankAccountBalanceHistory[]> => {
    if (!organizationId) return [];

    const { data, error } = await supabase
      .from('bank_account_balance_history')
      .select('*')
      .eq('bank_account_id', bankAccountId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching balance history:', error);
      throw error;
    }

    return (data || []).map((item: Record<string, unknown>) => ({
      ...item,
      amount: parseFloat(String(item.amount)),
      balance_before: parseFloat(String(item.balance_before)),
      balance_after: parseFloat(String(item.balance_after)),
    })) as BankAccountBalanceHistory[];
  };

  return {
    balances,
    loading,
    isPending,
    refetch,
    getOrCreateBalance,
    updateBalance,
    getBalanceHistory,
  };
};

/** Period credits to payout bank from completed Xendit gateway withdrawals (not income_transactions). */
export function useGatewayWithdrawalBankPeriodCredits(
  startDate: Date,
  endDate: Date,
  enabled = true,
) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [
      'gateway-withdrawal-bank-period-credits',
      organizationId,
      startDate.toISOString(),
      endDate.toISOString(),
    ],
    queryFn: async () => {
      if (!organizationId) return {} as Record<string, number>;

      const rows: { bank_account_id: string; amount: unknown }[] = [];
      let from = 0;
      for (;;) {
        const { data: chunk, error } = await supabase
          .from('bank_account_balance_history')
          .select('bank_account_id, amount')
          .eq('organization_id', organizationId)
          .eq('transaction_type', 'gateway_withdrawal')
          .gte('created_at', startDate.toISOString())
          .lt('created_at', endDate.toISOString())
          .range(from, from + LEDGER_PAGE_SIZE - 1);

        if (error) throw error;
        const part = chunk ?? [];
        rows.push(...part);
        if (part.length < LEDGER_PAGE_SIZE) break;
        from += LEDGER_PAGE_SIZE;
      }

      const map: Record<string, number> = {};
      for (const row of rows) {
        const id = row.bank_account_id;
        const amt = Number(row.amount ?? 0);
        if (!id || !Number.isFinite(amt) || amt <= 0) continue;
        map[id] = (map[id] ?? 0) + amt;
      }
      return map;
    },
    enabled: Boolean(organizationId) && enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
