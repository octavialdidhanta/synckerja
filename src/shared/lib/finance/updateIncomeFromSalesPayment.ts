import type { SupabaseClient } from '@supabase/supabase-js';
import type { IncomeBankLedgerUpdater } from './deleteIncomeTransactionForOrg';

export type SalesPaymentIncomePatch = {
  amount?: number;
  transaction_date?: string;
  payment_method?: string | null;
  description?: string | null;
  receipt_file_path?: string | null;
};

/**
 * Updates the income row linked to a sales payment and adjusts bank ledger when
 * `amount` changes on a row that has `bank_account_id` (same rules as dashboard `updateMutation`).
 */
export async function updateIncomeFromSalesPayment(params: {
  supabase: SupabaseClient;
  organizationId: string;
  salesActivityPaymentId: string;
  patch: SalesPaymentIncomePatch;
  updateBalance: IncomeBankLedgerUpdater;
}): Promise<void> {
  const { supabase, organizationId, salesActivityPaymentId, patch, updateBalance } = params;

  const { data: income, error: findErr } = await supabase
    .from('income_transactions')
    .select('id, bank_account_id, amount, description, customer_name')
    .eq('organization_id', organizationId)
    .eq('sales_activity_payment_id', salesActivityPaymentId)
    .maybeSingle();

  if (findErr) throw findErr;
  if (!income?.id) return;

  const oldBankId = income.bank_account_id as string | null;
  const oldAmount = income.amount != null ? parseFloat(String(income.amount)) : 0;

  const updatePayload: Record<string, unknown> = {};
  if (patch.amount !== undefined) updatePayload.amount = patch.amount;
  if (patch.transaction_date !== undefined) updatePayload.transaction_date = patch.transaction_date;
  if (patch.payment_method !== undefined) updatePayload.payment_method = patch.payment_method;
  if (patch.description !== undefined) updatePayload.description = patch.description;
  if (patch.receipt_file_path !== undefined) updatePayload.receipt_file_path = patch.receipt_file_path;

  if (Object.keys(updatePayload).length === 0) return;

  const { data: updated, error: upErr } = await supabase
    .from('income_transactions')
    .update(updatePayload)
    .eq('id', income.id)
    .eq('organization_id', organizationId)
    .select('id, bank_account_id, amount, description, customer_name')
    .single();

  if (upErr) throw upErr;
  if (!updated?.id) return;

  const newBankId = (updated.bank_account_id as string | null) ?? null;
  const newAmount =
    patch.amount !== undefined ? Number(patch.amount) : parseFloat(String(updated.amount ?? 0));
  const descBase =
    (patch.description && String(patch.description).trim()) ||
    (updated.description && String(updated.description).trim()) ||
    (updated.customer_name && String(updated.customer_name).trim()) ||
    'Transaction';

  try {
    if (newBankId) {
      if (oldBankId && oldBankId !== newBankId) {
        await updateBalance(oldBankId, -oldAmount, 'expense', updated.id, `Income moved: ${descBase}`);
        await updateBalance(newBankId, newAmount, 'income', updated.id, `Income: ${descBase}`);
      } else if (oldBankId === newBankId) {
        const delta = newAmount - oldAmount;
        if (Math.abs(delta) > 1e-6) {
          await updateBalance(newBankId, delta, 'income', updated.id, `Income updated: ${descBase}`);
        }
      } else {
        await updateBalance(newBankId, newAmount, 'income', updated.id, `Income: ${descBase}`);
      }
    } else if (oldBankId) {
      await updateBalance(oldBankId, -oldAmount, 'expense', updated.id, `Income updated (unlinked): ${descBase}`);
    }
  } catch (balanceError) {
    console.error('Error updating bank account balance after income sync:', balanceError);
  }
}
