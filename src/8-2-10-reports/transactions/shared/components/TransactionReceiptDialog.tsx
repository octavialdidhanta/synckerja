import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { changeDue } from "@/5-2-customer-visits/checkout/lib/cashChange";
import {
  formatStoreReceiptDateTime,
  formatStoreReceiptNumber,
} from "@/5-2-customer-visits/checkout/lib/formatStoreReceiptNumber";
import { useStoreCheckoutPricing } from "@/5-2-customer-visits/checkout/hooks/useStoreCheckoutPricing";
import { computeCatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import { PosReceiptDocument } from "@/8-2-6-receipt/components/PosReceiptDocument";
import { useResolvedPosReceipt } from "@/8-2-6-receipt/hooks/useResolvedPosReceipt";
import { Button } from "@/shared/components/ui/button";
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
import { useTransactionReceiptDetail } from "../hooks/useTransactionReceiptDetail";
import { mapTransactionToPosReceiptTransaction } from "../lib/mapTransactionReceipt";
import type { SuccessOrderRow } from "../lib/transactionsTypes";

type Props = {
  row: SuccessOrderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TransactionReceiptDialog({ row, open, onOpenChange }: Props) {
  const { t } = useAppTranslation();
  const activityId = row?.activityId ?? null;
  const detailQuery = useTransactionReceiptDetail(activityId);
  const outletId = detailQuery.data?.posOutletId ?? row?.outletId ?? null;
  const { branding, isLoading: brandingLoading } = useResolvedPosReceipt(outletId);
  const pricing = useStoreCheckoutPricing(outletId, detailQuery.data?.catalogSalesTypeId ?? null);

  const transaction = useMemo(() => {
    const detail = detailQuery.data;
    if (!detail || !row) return null;

    const receiptNumber = formatStoreReceiptNumber(detail.salesActivityId);
    const datetime = formatStoreReceiptDateTime({
      saleCreatedAt: detail.createdAt,
      visitCreatedAt: null,
      visitDate: detail.date,
    });
    const amount = detail.totalPaidAmount ?? detail.totalAmount;
    const cashTendered = detail.cashTendered;
    const showCash =
      detail.paymentMethod === "cash" &&
      cashTendered != null &&
      Number.isFinite(cashTendered) &&
      cashTendered >= 0;
    const change = showCash ? changeDue(amount, cashTendered) : null;

    const subtotal = Number(detail.checkoutSubtotal);
    const recomputedTotals =
      Number.isFinite(subtotal) && subtotal > 0
        ? computeCatalogCheckoutTotals({
            subtotal,
            settings: pricing.settings,
            taxes: pricing.outletTaxes,
            gratuities: pricing.outletGratuities,
          })
        : null;

    const payMethod = detail.paymentMethod
      ? t(`customerVisits.checkout.method.${detail.paymentMethod}`, detail.paymentMethod)
      : "—";

    const mapped = mapTransactionToPosReceiptTransaction({
      detail: {
        ...detail,
        servedByName: detail.servedByName ?? row.servedByName,
        collectedByName: detail.collectedByName ?? row.collectedByName,
        taxLines:
          detail.taxLines.length > 0
            ? detail.taxLines
            : (recomputedTotals?.taxLines ?? []),
        gratuityLines:
          detail.gratuityLines.length > 0
            ? detail.gratuityLines
            : (recomputedTotals?.gratuityLines ?? []),
      },
      receiptNumber,
      datetime,
      payMethodLabel: payMethod,
      change,
    });

    return mapped;
  }, [detailQuery.data, pricing, row, t]);

  const loading = detailQuery.isLoading || brandingLoading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base">
            {t("reports.transactions.receipt.title", "Receipt")}{" "}
            {row?.receiptCode ? `· ${row.receiptCode}` : ""}
          </SheetTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button type="button" size="sm" variant="outline" disabled>
                      {t("reports.transactions.receipt.resend", "Resend Receipt")}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {t("reports.transactions.receipt.comingSoon", "Coming soon")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button type="button" size="sm" variant="outline" disabled>
                      {t("reports.transactions.receipt.refund", "Issue Refund")}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {t("reports.transactions.receipt.comingSoon", "Coming soon")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </SheetHeader>
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 justify-center overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : transaction ? (
            <PosReceiptDocument
              branding={branding}
              transaction={transaction}
              showClientBlock
              showServedCollected
              showLinks
              showNote
            />
          ) : (
            <p className="py-8 text-sm text-muted-foreground">
              {t("reports.transactions.receipt.notFound", "Receipt not found.")}
            </p>
          )}
        </div>
        <SheetFooter className="shrink-0 border-t px-4 py-3 sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("common.done", "Done")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function formatTransactionListTime(iso: string): string {
  try {
    return format(parseISO(iso), "HH:mm");
  } catch {
    return "";
  }
}
