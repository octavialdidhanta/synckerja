import { supabase } from '@/shared/lib/supabaseClient';
import { isValidDebtPaymentBankAccountId } from './submitDebtPayment';

type UpdateBalanceFn = (
  bankAccountId: string,
  amount: number,
  transactionType: 'income' | 'expense' | 'manual_adjustment',
  transactionId?: string,
  description?: string
) => Promise<void>;

/**
 * Deletes one debt_payment row. If payment_method is a bank account UUID, credits that account first (refund).
 * Rolls back the credit if delete fails.
 */
export async function deleteDebtPaymentWithRefund(params: {
  organizationId: string;
  paymentId: string;
  paymentAmount: number;
  paymentMethod: string | null;
  debtDisplayName: string;
  updateBalance: UpdateBalanceFn;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { organizationId, paymentId, paymentAmount, paymentMethod, debtDisplayName, updateBalance } = params;

  const amt = parseFloat(String(paymentAmount));
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, message: 'Invalid payment amount' };
  }

  const bankId = paymentMethod?.trim() ?? '';
  let refunded = false;

  try {
    if (isValidDebtPaymentBankAccountId(bankId)) {
      await updateBalance(
        bankId,
        amt,
        'manual_adjustment',
        paymentId,
        `Payment removed: refund (${debtDisplayName})`
      );
      refunded = true;
    }

    const { error } = await supabase
      .from('debt_payments')
      .delete()
      .eq('id', paymentId)
      .eq('organization_id', organizationId);

    if (error) {
      if (refunded) {
        try {
          await updateBalance(
            bankId,
            -amt,
            'manual_adjustment',
            paymentId,
            'Rollback: payment record could not be removed'
          );
        } catch (rollbackErr) {
          console.error('deleteDebtPaymentWithRefund rollback failed', rollbackErr);
        }
      }
      return { ok: false, message: error.message };
    }

    return { ok: true };
  } catch (e) {
    if (refunded) {
      try {
        await updateBalance(
          bankId,
          -amt,
          'manual_adjustment',
          paymentId,
          'Rollback: payment removal failed'
        );
      } catch (rollbackErr) {
        console.error('deleteDebtPaymentWithRefund rollback failed', rollbackErr);
      }
    }
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
