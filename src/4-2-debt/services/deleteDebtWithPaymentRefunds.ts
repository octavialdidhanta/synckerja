import { supabase } from '@/shared/lib/supabaseClient';
import { isValidDebtPaymentBankAccountId } from './submitDebtPayment';

type UpdateBalanceFn = (
  bankAccountId: string,
  amount: number,
  transactionType: 'income' | 'expense' | 'manual_adjustment',
  transactionId?: string,
  description?: string
) => Promise<void>;

async function reverseAppliedRefunds(
  updateBalance: UpdateBalanceFn,
  applied: { bankAccountId: string; amount: number; paymentId: string }[]
): Promise<void> {
  for (const r of [...applied].reverse()) {
    try {
      await updateBalance(
        r.bankAccountId,
        -r.amount,
        'manual_adjustment',
        r.paymentId,
        'Rollback: debt deletion did not complete'
      );
    } catch (err) {
      console.error('reverseAppliedRefunds failed for payment', r.paymentId, err);
    }
  }
}

/**
 * Refunds each debt_payment amount to its payment_method bank account, then deletes the debt.
 * debt_payments rows are removed by ON DELETE CASCADE.
 * On failure after partial refunds, attempts to reverse those refunds.
 */
export async function deleteDebtWithPaymentRefunds(options: {
  organizationId: string;
  debtId: string;
  debtDisplayName: string;
  updateBalance: UpdateBalanceFn;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { organizationId, debtId, debtDisplayName, updateBalance } = options;

  const { data: rows, error: fetchErr } = await supabase
    .from('debt_payments')
    .select('id, payment_amount, payment_method')
    .eq('organization_id', organizationId)
    .eq('debt_id', debtId);

  if (fetchErr) {
    return { ok: false, message: fetchErr.message };
  }

  const applied: { bankAccountId: string; amount: number; paymentId: string }[] = [];
  const refundDescription = `Debt removed: refund payment (${debtDisplayName})`;

  try {
    for (const row of rows ?? []) {
      const method = row.payment_method as string | null | undefined;
      if (!isValidDebtPaymentBankAccountId(method)) continue;
      const amt = parseFloat(String(row.payment_amount));
      if (!Number.isFinite(amt) || amt <= 0) continue;
      const bankId = String(method).trim();
      const paymentId = String(row.id);
      await updateBalance(bankId, amt, 'manual_adjustment', paymentId, refundDescription);
      applied.push({ bankAccountId: bankId, amount: amt, paymentId });
    }
  } catch (e) {
    await reverseAppliedRefunds(updateBalance, applied);
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  const { error: delErr } = await supabase
    .from('debts')
    .delete()
    .eq('id', debtId)
    .eq('organization_id', organizationId);

  if (delErr) {
    await reverseAppliedRefunds(updateBalance, applied);
    return { ok: false, message: delErr.message };
  }

  return { ok: true };
}
