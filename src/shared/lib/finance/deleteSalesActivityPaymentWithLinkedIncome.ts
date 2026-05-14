import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteIncomeTransactionForOrg, type IncomeBankLedgerUpdater } from './deleteIncomeTransactionForOrg';

/**
 * Deletes a `sales_activity_payments` row after removing its linked `income_transactions`
 * row (if any). Fails if income cannot be deleted (e.g. allocations) — caller should toast.
 */
export async function deleteSalesActivityPaymentWithLinkedIncome(params: {
  supabase: SupabaseClient;
  organizationId: string;
  paymentId: string;
  updateBalance: IncomeBankLedgerUpdater;
}): Promise<void> {
  const { supabase, organizationId, paymentId, updateBalance } = params;

  const { data: incomeRow, error: incomeLookupError } = await supabase
    .from('income_transactions')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('sales_activity_payment_id', paymentId)
    .maybeSingle();

  if (incomeLookupError) throw incomeLookupError;

  if (incomeRow?.id) {
    await deleteIncomeTransactionForOrg({
      supabase,
      organizationId,
      incomeTransactionId: incomeRow.id,
      updateBalance,
    });
  }

  const { error: payDel } = await supabase
    .from('sales_activity_payments')
    .delete()
    .eq('id', paymentId)
    .eq('organization_id', organizationId);

  if (payDel) throw payDel;
}
