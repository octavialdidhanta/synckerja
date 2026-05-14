import type { SupabaseClient } from '@supabase/supabase-js';

/** Matches `useBankAccountBalances` `updateBalance` signature used by income flows. */
export type IncomeBankLedgerUpdater = (
  bankAccountId: string,
  amount: number,
  transactionType: 'income' | 'expense' | 'manual_adjustment',
  transactionId?: string,
  description?: string
) => Promise<void>;

/**
 * Deletes one income row with the same RPC + bank reversal semantics as
 * `deleteMutation` in `useIncomeTransactions` (dashboard).
 */
export async function deleteIncomeTransactionForOrg(params: {
  supabase: SupabaseClient;
  organizationId: string;
  incomeTransactionId: string;
  updateBalance: IncomeBankLedgerUpdater;
}): Promise<void> {
  const { supabase, organizationId, incomeTransactionId, updateBalance } = params;

  const { data: row, error: fetchError } = await supabase
    .from('income_transactions')
    .select('id, bank_account_id, amount, description, customer_name')
    .eq('id', incomeTransactionId)
    .eq('organization_id', organizationId)
    .single();

  if (fetchError) throw fetchError;
  if (!row) throw new Error('Transaction not found');

  const { error: rpcError } = await supabase.rpc('delete_bank_transfer_by_income_transaction', {
    p_income_transaction_id: incomeTransactionId,
  });
  if (!rpcError) {
    return;
  }
  const rpcMsg = [rpcError.message, (rpcError as { details?: string }).details]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
  if (!rpcMsg.includes('NOT_BANK_TRANSFER_INCOME')) {
    throw rpcError;
  }

  const bankId = row.bank_account_id as string | null;
  const amt = parseFloat(String(row.amount ?? 0));
  const label =
    (row.description && String(row.description).trim()) ||
    (row.customer_name && String(row.customer_name).trim()) ||
    'Transaction';

  let balanceReversed = false;
  try {
    if (bankId && Number.isFinite(amt) && Math.abs(amt) > 1e-9) {
      await updateBalance(bankId, -amt, 'income', row.id, `Income deleted: ${label}`);
      balanceReversed = true;
    }

    const { error: delError } = await supabase
      .from('income_transactions')
      .delete()
      .eq('id', incomeTransactionId)
      .eq('organization_id', organizationId);

    if (delError) throw delError;
  } catch (e) {
    if (balanceReversed && bankId && Number.isFinite(amt) && Math.abs(amt) > 1e-9) {
      try {
        await updateBalance(bankId, amt, 'income', row.id, 'Rollback: income delete failed');
      } catch (rollbackErr) {
        console.error('Income delete balance rollback failed:', rollbackErr);
      }
    }
    throw e;
  }
}
