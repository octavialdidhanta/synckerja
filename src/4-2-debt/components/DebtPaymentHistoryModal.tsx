import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Debt } from '../types';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useDebtPayments } from '../hooks/useDebtPayments';
import { SwipeableDebtPaymentRow } from './SwipeableDebtPaymentRow';

interface DebtPaymentHistoryModalProps {
  debt: Debt | null;
  isOpen: boolean;
  onClose: () => void;
  /** Refresh debt list (paid_amount / remaining) after a payment is removed */
  onPaymentDeleted?: () => void;
}

export const DebtPaymentHistoryModal = ({
  debt,
  isOpen,
  onClose,
  onPaymentDeleted,
}: DebtPaymentHistoryModalProps) => {
  const { t } = useAppTranslation();
  const debtId = debt?.id ?? null;
  const { payments, isLoading, refetch } = useDebtPayments(debtId);

  if (!debt) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[min(92vw,420px)] aspect-square max-h-[92vw] sm:max-h-[420px] flex flex-col p-0 overflow-hidden min-w-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0 p-4 pb-2 border-b">
          <DialogTitle className="text-lg font-semibold">
            {t('debt.paymentHistory.title', 'Payment History')} — {debt.debt_name}
          </DialogTitle>
          <DialogDescription>
            {t('debt.paymentHistory.description', 'Riwayat pembayaran untuk hutang ini.')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4">
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <div className="animate-pulse text-sm text-gray-500">
                {t('debt.paymentHistory.loading', 'Loading...')}
              </div>
            </div>
          ) : payments.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              {t('debt.paymentHistory.noPayments', 'Belum ada riwayat pembayaran.')}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto seamless-scroll py-2 space-y-2">
              {payments.map((payment) => (
                <SwipeableDebtPaymentRow
                  key={payment.id}
                  payment={payment}
                  debtDisplayName={debt.debt_name}
                  variant="desktop"
                  t={t}
                  refetchPayments={async () => {
                    await refetch();
                  }}
                  onPaymentDeleted={onPaymentDeleted}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 p-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {t('debt.form.cancel', 'Cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
