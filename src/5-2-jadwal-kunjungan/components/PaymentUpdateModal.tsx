import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { InvoicePreviewModal } from './invoice';
import { usePaymentUpdateModal } from '@/5-2-jadwal-kunjungan/hooks/usePaymentUpdateModal';
import { PaymentUpdateModalBody } from './PaymentUpdateModalBody';

interface PaymentUpdateModalProps {
  open: boolean;
  onClose: () => void;
  salesActivityId: string;
  clientName?: string;
  viewOnly?: boolean;
  /** `livechat`: inline Generate Invoice in Actions; same add-payment + invoice preview as default. */
  variant?: 'default' | 'livechat';
  onFirstPaymentSuccess?: (payload: {
    title: string;
    description: string;
    service_id: string;
    sub_service_id: string | null;
  }) => void;
}

export const PaymentUpdateModal = ({
  open,
  onClose,
  salesActivityId,
  clientName,
  viewOnly = false,
  variant = 'default',
  onFirstPaymentSuccess,
}: PaymentUpdateModalProps) => {
  const model = usePaymentUpdateModal({
    open,
    salesActivityId,
    clientName,
    viewOnly,
    variant,
    onFirstPaymentSuccess,
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="text-lg font-semibold">
            Payment History - {clientName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
          <PaymentUpdateModalBody layout="desktop" model={model} />
        </ScrollArea>

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
};
