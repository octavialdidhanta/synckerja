import { Loader2, MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { PosReceiptDocument } from "@/8-2-6-receipt/components/PosReceiptDocument";
import { useResolvedPosReceipt } from "@/8-2-6-receipt/hooks/useResolvedPosReceipt";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import { PaymentRecordingSheet } from "@/shared/sales-payments";
import { useInvoiceDetail } from "../hooks/useInvoiceDetail";
import {
  invoiceDueBannerText,
  mapInvoiceDocumentTransaction,
} from "../lib/mapInvoiceDocument";
import type { InvoiceRow } from "../lib/invoicesTypes";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

type Props = {
  row: InvoiceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled?: () => void;
};

export function InvoiceDetailSheet({ row, open, onOpenChange, onCancelled }: Props) {
  const { t } = useAppTranslation();
  const activityId = row?.activityId ?? null;
  const detailQuery = useInvoiceDetail(activityId);
  const detail = detailQuery.data;
  const outletId = detail?.posOutletId ?? row?.outletId ?? null;
  const { branding, isLoading: brandingLoading } = useResolvedPosReceipt(outletId);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const transaction = useMemo(
    () => (detail ? mapInvoiceDocumentTransaction(detail) : null),
    [detail],
  );

  const bannerText = useMemo(() => {
    if (!detail) return null;
    return invoiceDueBannerText({
      displayStatus: detail.displayStatus,
      invoiceDueDate: detail.invoiceDueDate,
      overdueDays: detail.overdueDays,
      dueTodayLabel: t("reports.invoices.detail.dueToday", "Due today"),
      overdueLabel: (days) =>
        t("reports.invoices.detail.overdueDays", "{{days}} days overdue", { days }),
      dueByLabel: (date) =>
        t("reports.invoices.detail.dueBy", "Due by {{date}}", { date }),
      paidLabel: t("reports.invoices.detail.paid", "Paid in full"),
      cancelledLabel: t("reports.invoices.detail.cancelled", "Invoice cancelled"),
    });
  }, [detail, t]);

  const loading = detailQuery.isLoading || brandingLoading;
  const canRecordPayment =
    detail &&
    detail.displayStatus !== "paid" &&
    detail.displayStatus !== "cancelled" &&
    detail.amountDue > 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-12 text-left">
            <SheetTitle className="text-base">
              {t("reports.invoices.detail.title", "Invoice")}{" "}
              {row?.invoiceNumber ? `· ${row.invoiceNumber}` : ""}
            </SheetTitle>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button type="button" size="sm" variant="outline" disabled>
                        {t("reports.invoices.detail.resend", "Resend")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("reports.invoices.detail.comingSoon", "Coming soon")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {canRecordPayment ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setPaymentOpen(true)}
                >
                  {t("reports.invoices.detail.recordPayment", "Record Payment")}
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled>
                    {t("reports.invoices.detail.cancel", "Cancel invoice")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetHeader>
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {bannerText ? (
              <div
                className={`shrink-0 border-b px-4 py-2 text-sm ${
                  detail?.displayStatus === "overdue"
                    ? "bg-red-50 text-red-900"
                    : detail?.displayStatus === "paid"
                      ? "bg-emerald-50 text-emerald-900"
                      : detail?.displayStatus === "cancelled"
                        ? "bg-gray-50 text-gray-700"
                        : "bg-amber-50 text-amber-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{bannerText}</span>
                  {detail ? <InvoiceStatusBadge status={detail.displayStatus} /> : null}
                </div>
              </div>
            ) : null}
            <div className="flex flex-1 justify-center p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : transaction ? (
                <PosReceiptDocument
                  branding={branding}
                  transaction={transaction}
                  showClientBlock
                  showLinks={false}
                  showNote={false}
                />
              ) : (
                <p className="py-8 text-sm text-muted-foreground">
                  {t("reports.invoices.detail.notFound", "Invoice not found.")}
                </p>
              )}
            </div>
            {detail ? (
              <div className="shrink-0 space-y-2 border-t px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("reports.invoices.detail.total", "Total")}
                  </span>
                  <span className="font-medium">{formatReportsMoney(detail.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("reports.invoices.detail.received", "Amount received")}
                  </span>
                  <span>{formatReportsMoney(detail.totalPaidAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("reports.invoices.detail.due", "Amount due")}
                  </span>
                  <span className="font-medium">{formatReportsMoney(detail.amountDue)}</span>
                </div>
                {detail.payments.length > 0 ? (
                  <button
                    type="button"
                    className="text-xs text-primary underline-offset-2 hover:underline"
                    onClick={() => setHistoryOpen(true)}
                  >
                    {t("reports.invoices.detail.viewHistory", "View payment history")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <SheetFooter className="shrink-0 border-t px-4 py-3 sm:justify-end">
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t("common.done", "Done")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {detail && paymentOpen ? (
        <PaymentRecordingSheet
          open={paymentOpen}
          onClose={() => {
            setPaymentOpen(false);
            detailQuery.refetch();
            onCancelled?.();
          }}
          salesActivityId={detail.activityId}
          clientName={detail.clientName}
        />
      ) : null}

      {detail && historyOpen ? (
        <PaymentRecordingSheet
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          salesActivityId={detail.activityId}
          clientName={detail.clientName}
          viewOnly
        />
      ) : null}
    </>
  );
}
