import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { deleteDebtPaymentWithRefund } from '../services/deleteDebtPaymentWithRefund';
import type { DebtPaymentRecord } from '../hooks/useDebtPayments';
import { DebtPaymentHistoryCardContent } from './DebtPaymentHistoryCardContent';
import { cn } from '@/shared/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';

const REVEAL_PX = 76;
/** ease-in-out style for snap-back / open */
const SLIDE_TRANSITION = 'transform 0.38s cubic-bezier(0.42, 0, 0.58, 1)';

export interface SwipeableDebtPaymentRowProps {
  payment: DebtPaymentRecord;
  debtDisplayName: string;
  variant?: 'desktop' | 'mobile';
  t: (key: string, fallback?: string) => string;
  refetchPayments: () => Promise<unknown>;
  onPaymentDeleted?: () => void;
}

export function SwipeableDebtPaymentRow({
  payment,
  debtDisplayName,
  variant = 'desktop',
  t,
  refetchPayments,
  onPaymentDeleted,
}: SwipeableDebtPaymentRowProps) {
  const { organizationId } = useCurrentOrg();
  const { updateBalance } = useBankAccountBalances();
  const [offset, setOffset] = useState(0);
  const [useTransition, setUseTransition] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const axisRef = useRef<null | 'h' | 'v'>(null);
  const mouseDraggingRef = useRef(false);

  const clampOffset = useCallback((v: number) => Math.min(0, Math.max(-REVEAL_PX, v)), []);

  const finishHorizontalGesture = useCallback(() => {
    setUseTransition(true);
    setOffset((prev) => (prev < -REVEAL_PX / 2 ? -REVEAL_PX : 0));
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isDeleting) return;
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      startOffsetRef.current = offset;
      axisRef.current = null;
    },
    [isDeleting, offset]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isDeleting) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - startXRef.current;
      const dy = y - startYRef.current;
      if (axisRef.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        axisRef.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      }
      if (axisRef.current === 'h') {
        e.preventDefault();
        e.stopPropagation();
        setUseTransition(false);
        setOffset(clampOffset(startOffsetRef.current + dx));
      }
    },
    [clampOffset, isDeleting]
  );

  const onTouchEnd = useCallback(() => {
    if (axisRef.current === 'h') {
      finishHorizontalGesture();
    }
    axisRef.current = null;
  }, [finishHorizontalGesture]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isDeleting) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button,a,input,textarea,select')) return;
      mouseDraggingRef.current = true;
      startXRef.current = e.clientX;
      startOffsetRef.current = offset;
      setUseTransition(false);
      e.preventDefault();
    },
    [isDeleting, offset]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!mouseDraggingRef.current) return;
      const dx = e.clientX - startXRef.current;
      setOffset(clampOffset(startOffsetRef.current + dx));
    };
    const onUp = () => {
      if (!mouseDraggingRef.current) return;
      mouseDraggingRef.current = false;
      finishHorizontalGesture();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [clampOffset, finishHorizontalGesture]);

  const performDelete = useCallback(async () => {
    if (isDeleting || !organizationId) return;
    setOffset(0);
    setUseTransition(true);
    setIsDeleting(true);
    try {
      const result = await deleteDebtPaymentWithRefund({
        organizationId,
        paymentId: payment.id,
        paymentAmount: payment.payment_amount,
        paymentMethod: payment.payment_method,
        debtDisplayName,
        updateBalance,
      });
      if (result.ok) {
        toast.success(t('debt.paymentHistory.deleteSuccess', 'Payment removed.'));
        await refetchPayments();
        onPaymentDeleted?.();
      } else {
        toast.error(result.message || t('debt.paymentHistory.deleteFailed', 'Could not remove payment.'));
      }
    } finally {
      setIsDeleting(false);
    }
  }, [
    debtDisplayName,
    isDeleting,
    onPaymentDeleted,
    organizationId,
    payment.id,
    payment.payment_amount,
    payment.payment_method,
    refetchPayments,
    t,
    updateBalance,
  ]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (isDeleting || !organizationId) return;
      setOffset(0);
      setUseTransition(true);
      setDeleteConfirmOpen(true);
    },
    [isDeleting, organizationId]
  );

  const handleConfirmDelete = useCallback(() => {
    setDeleteConfirmOpen(false);
    void performDelete();
  }, [performDelete]);

  const paddingClass = variant === 'mobile' ? 'p-2.5' : 'p-3';

  return (
    <>
      <div className="relative rounded-lg overflow-hidden select-none">
        {/* Solid layer behind the card — trash sits on this plane */}
        <div
          className="absolute inset-0 z-0 flex justify-end rounded-lg bg-brand-red dark:bg-brand-red"
          aria-hidden
        >
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDeleteClick}
            className={cn(
              'flex w-[76px] shrink-0 items-center justify-center text-white transition-opacity',
              isDeleting ? 'opacity-70 cursor-wait' : 'hover:bg-brand-red/90 dark:hover:bg-brand-red/90 active:opacity-90'
            )}
            aria-label={t('debt.paymentHistory.deletePayment', 'Delete payment')}
          >
            {isDeleting ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-6 w-6" strokeWidth={2} aria-hidden />
            )}
          </button>
        </div>

        {/* Sliding foreground */}
        <div
          className={cn(
            'relative z-[1] rounded-lg cursor-grab active:cursor-grabbing touch-pan-y',
            isDeleting && 'pointer-events-none opacity-80'
          )}
          style={{
            transform: `translateX(${offset}px)`,
            transition: useTransition ? SLIDE_TRANSITION : 'none',
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          role="presentation"
        >
          <DebtPaymentHistoryCardContent payment={payment} t={t} className={paddingClass} />
        </div>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent
          overlayClassName="z-[100]"
          className="z-[100] max-w-[min(92vw,400px)]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('debt.paymentHistory.deleteDialogTitle', 'Remove payment?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'debt.paymentHistory.deleteConfirm',
                'Remove this payment? The amount will be returned to the source bank balance if applicable.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-red text-white hover:bg-brand-red/90 focus:ring-brand-red dark:bg-brand-red dark:hover:bg-brand-red/90"
              onClick={(ev) => {
                ev.preventDefault();
                handleConfirmDelete();
              }}
            >
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
