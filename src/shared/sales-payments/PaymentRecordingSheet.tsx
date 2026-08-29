import { InvoicePreviewModal } from "@/5-2-jadwal-kunjungan/components/invoice";
import { PaymentUpdateModalBody } from "@/5-2-jadwal-kunjungan/components/PaymentUpdateModalBody";
import {
  usePaymentUpdateModal,
  type PaymentUpdateModalVariant,
} from "@/5-2-jadwal-kunjungan/hooks/usePaymentUpdateModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PaymentRecordingSheetProps } from "./paymentRecordingTypes";

function PaymentRecordingContent({
  clientName,
  viewOnly,
  variant,
  onFirstPaymentSuccess,
  open,
  salesActivityId,
}: Omit<PaymentRecordingSheetProps, "onClose" | "shell">) {
  const model = usePaymentUpdateModal({
    open,
    salesActivityId,
    clientName,
    viewOnly,
    variant: variant as PaymentUpdateModalVariant,
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
    <>
      <PaymentUpdateModalBody layout="desktop" model={model} />
      {showInvoicePreview && selectedPaymentForInvoice ? (
        <InvoicePreviewModal
          open={showInvoicePreview}
          onOpenChange={setShowInvoicePreview}
          paymentData={selectedPaymentForInvoice}
          clientName={hookClientName || ""}
          salesActivityId={hookSalesActivityId}
          salesActivityData={salesActivity}
        />
      ) : null}
    </>
  );
}

export function PaymentRecordingSheet({
  open,
  onClose,
  salesActivityId,
  clientName,
  viewOnly = false,
  variant = "default",
  shell = "sheet",
  onFirstPaymentSuccess,
}: PaymentRecordingSheetProps) {
  const { t } = useAppTranslation();
  const title = viewOnly
    ? t("salesPayments.historyTitle", "Payment History - {{name}}", { name: clientName ?? "—" })
    : t("salesPayments.recordTitle", "Record Payment - {{name}}", { name: clientName ?? "—" });

  if (shell === "dialog") {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden" aria-describedby={undefined}>
          <DialogHeader className="flex-shrink-0 pb-4">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-120px)] flex-1">
            <PaymentRecordingContent
              open={open}
              salesActivityId={salesActivityId}
              clientName={clientName}
              viewOnly={viewOnly}
              variant={variant}
              onFirstPaymentSuccess={onFirstPaymentSuccess}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <PaymentRecordingContent
            open={open}
            salesActivityId={salesActivityId}
            clientName={clientName}
            viewOnly={viewOnly}
            variant={variant}
            onFirstPaymentSuccess={onFirstPaymentSuccess}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
