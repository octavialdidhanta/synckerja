import { format } from 'date-fns';
import { Calendar, Receipt, CreditCard, Hash } from 'lucide-react';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import type { DebtPaymentRecord } from '../hooks/useDebtPayments';
import { cn } from '@/shared/lib/utils';
import { DebtXenditDisburseButton } from './DebtXenditDisburseButton';
import { DebtBrickDisburseButton } from './DebtBrickDisburseButton';

export function DebtPaymentHistoryCardContent({
  payment,
  t,
  className,
}: {
  payment: DebtPaymentRecord;
  t: (key: string, fallback?: string) => string;
  className?: string;
}) {
  const hasPrincipal = payment.principal_amount != null && payment.principal_amount > 0;
  const hasInterest = payment.interest_amount != null && payment.interest_amount > 0;

  return (
    <div
      className={cn(
        'border border-gray-200 rounded-lg bg-white shadow-sm',
        className ?? 'p-3'
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span className="font-medium text-gray-900">
            {format(new Date(payment.payment_date), 'dd MMM yyyy')}
          </span>
        </div>
        <span className="font-semibold text-brand-blue">{formatToRupiah(payment.payment_amount)}</span>
      </div>
      {(hasPrincipal || hasInterest) && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
          {hasPrincipal && (
            <span>
              {t('debt.paymentHistory.principal', 'Principal')}: {formatToRupiah(payment.principal_amount!)}
            </span>
          )}
          {hasInterest && (
            <span>
              {t('debt.paymentHistory.interest', 'Interest')}: {formatToRupiah(payment.interest_amount!)}
            </span>
          )}
        </div>
      )}
      <div className="mt-2 flex gap-2 text-xs text-gray-600">
        <CreditCard className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>
          {t('debt.payment.method', 'Payment Method')}:{' '}
          {payment.bank_account_name ?? t('debt.paymentHistory.notSelected', '—')}
        </span>
      </div>
      <div className="mt-2 flex gap-2 text-xs text-gray-600">
        <Hash className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span className="min-w-0 break-all font-mono">
          {t('debt.paymentHistory.transactionId', 'Transaction ID')}:{' '}
          {payment.transaction_reference?.trim() || '—'}
        </span>
      </div>
      <div className="mt-2 flex gap-2 text-xs text-gray-500">
        <Receipt className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span className="break-words">
          {t('debt.payment.notes', 'Notes')}:{' '}
          {payment.notes?.trim() ? payment.notes : t('debt.paymentHistory.notSelected', '—')}
        </span>
      </div>
      {!payment.xendit_disbursement_id || !payment.brick_disbursement_id ? (
        <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap gap-2">
          {!payment.xendit_disbursement_id ? (
            <DebtXenditDisburseButton
              debtPaymentId={payment.id}
              amount={payment.payment_amount}
              description={payment.notes ?? undefined}
            />
          ) : null}
          {!payment.brick_disbursement_id ? (
            <DebtBrickDisburseButton
              debtPaymentId={payment.id}
              amount={payment.payment_amount}
              description={payment.notes ?? undefined}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
