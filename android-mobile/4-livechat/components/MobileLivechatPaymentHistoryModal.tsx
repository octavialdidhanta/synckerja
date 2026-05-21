import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { InvoicePreviewModal } from '@/5-2-jadwal-kunjungan/components/invoice';
import { usePaymentUpdateModal } from '@/5-2-jadwal-kunjungan/hooks/usePaymentUpdateModal';
import { PaymentUpdateModalBody } from '@/5-2-jadwal-kunjungan/components/PaymentUpdateModalBody';

const SCROLL_HIDE =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export interface MobileLivechatPaymentHistoryModalProps {
  open: boolean;
  onClose: () => void;
  salesActivityId: string;
  clientName?: string;
  viewOnly?: boolean;
}

export function MobileLivechatPaymentHistoryModal({
  open,
  onClose,
  salesActivityId,
  clientName,
  viewOnly = false,
}: MobileLivechatPaymentHistoryModalProps) {
  const model = usePaymentUpdateModal({
    open,
    salesActivityId,
    clientName,
    viewOnly,
    variant: 'livechat',
  });

  const {
    showInvoicePreview,
    setShowInvoicePreview,
    selectedPaymentForInvoice,
    clientName: hookClientName,
    salesActivityId: hookSalesActivityId,
    salesActivity,
  } = model;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'modal-above-safe-area fixed inset-x-0 top-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0',
        )}
        fullscreenAnimation
        hideCloseButton
        overlayClassName="modal-overlay-above-safe-area"
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader
          className={cn(
            'safe-area-top flex-shrink-0 flex-row items-center justify-between gap-2 border-b bg-gradient-to-r from-brand-blue/10 to-brand-blue/5 px-4 py-3 text-left',
          )}
        >
          <DialogTitle className="min-w-0 flex-1 truncate text-base font-semibold">
            Payment History - {clientName}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onClose}
            aria-label="Close payment history"
          >
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', SCROLL_HIDE)}>
          <div className={cn('min-h-0 flex-1 overflow-y-auto overflow-x-hidden', SCROLL_HIDE)}>
            <PaymentUpdateModalBody layout="mobile" model={model} />
          </div>
        </div>

        {showInvoicePreview && selectedPaymentForInvoice && (
          <InvoicePreviewModal
            open={showInvoicePreview}
            onOpenChange={setShowInvoicePreview}
            paymentData={selectedPaymentForInvoice}
            clientName={hookClientName || ''}
            salesActivityId={hookSalesActivityId}
            salesActivityData={salesActivity}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
