import { ChevronRight, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatPosCash } from "@/shared/pos-shift";
import { useShiftDetail } from "../../hooks/useShiftDetail";
import { formatShiftDifference, isShiftShortage } from "../lib/formatShiftDifference";
import type { ShiftRow } from "../lib/shiftTypes";
import { ShiftCashMovementsDialog } from "./ShiftCashMovementsDialog";
import { ShiftPaymentMethodsSection } from "./ShiftPaymentMethodsSection";
import { ShiftSoldItemsDialog } from "./ShiftSoldItemsDialog";

type Props = {
  row: ShiftRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
      {children}
    </h3>
  );
}

function DetailRow({
  label,
  value,
  onClick,
  valueClassName,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  valueClassName?: string;
}) {
  const clickable = Boolean(onClick);
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-left text-sm last:border-b-0",
        clickable && "hover:bg-muted/30",
        !clickable && "cursor-default",
      )}
    >
      <span className="text-gray-800">{label}</span>
      <span className="flex items-center gap-1">
        <span className={cn("tabular-nums font-medium text-gray-900", valueClassName)}>
          {value}
        </span>
        {clickable ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
      </span>
    </button>
  );
}

function formatShiftWhen(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale === "id" ? "id-ID" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ShiftDetailSheet({ row, open, onOpenChange }: Props) {
  const { t, language } = useAppTranslation();
  const shiftId = row?.shiftId ?? null;
  const detailQuery = useShiftDetail(open ? shiftId : null);
  const detail = detailQuery.data;
  const [soldOpen, setSoldOpen] = useState(false);
  const [cashIoOpen, setCashIoOpen] = useState(false);

  const soldLinesRaw = useMemo(
    () =>
      (detail?.soldLines ?? []).map((line) => ({
        service_name: line.serviceName,
        sub_service_name: line.subServiceName,
        quantity: line.quantity,
      })),
    [detail?.soldLines],
  );

  const loading = detailQuery.isLoading && !detail;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("reports.shift.detail.title", "Shift Details")}</SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="scrollbar-hide flex-1 overflow-y-auto pb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <SectionTitle>
                {t("reports.shift.detail.shiftSection", "SHIFT DETAILS")}
              </SectionTitle>
              <div className="overflow-hidden rounded-md border border-border">
                <DetailRow
                  label={t("reports.shift.detail.name", "Name")}
                  value={detail.openedByName}
                />
                <DetailRow
                  label={t("reports.shift.detail.outlet", "Outlet")}
                  value={detail.outletName}
                />
                <DetailRow
                  label={t("reports.shift.detail.started", "Shift Started")}
                  value={formatShiftWhen(detail.openedAt, String(language ?? "id"))}
                />
                {detail.closedAt ? (
                  <DetailRow
                    label={t("reports.shift.detail.ended", "Shift Ended")}
                    value={formatShiftWhen(detail.closedAt, String(language ?? "id"))}
                  />
                ) : null}
                <DetailRow
                  label={t("reports.shift.cashIo.title", "Cash Out / Cash In")}
                  value={formatPosCash(detail.cashInOutNet)}
                  onClick={() => setCashIoOpen(true)}
                />
              </div>

              <SectionTitle>
                {t("reports.shift.detail.orderSection", "ORDER DETAILS")}
              </SectionTitle>
              <div className="overflow-hidden rounded-md border border-border">
                <DetailRow
                  label={t("reports.shift.detail.productsSold", "Products Sold")}
                  value={String(Math.round(detail.productsSoldQty))}
                  onClick={
                    detail.productsSoldQty > 0 ? () => setSoldOpen(true) : undefined
                  }
                />
                <DetailRow
                  label={t("reports.shift.detail.productsRefund", "Refunded Products")}
                  value={String(Math.round(detail.refundedProductsQty))}
                />
              </div>

              <SectionTitle>{t("reports.shift.detail.cashSection", "CASH")}</SectionTitle>
              <div className="overflow-hidden rounded-md border border-border">
                <DetailRow
                  label={t("reports.shift.detail.cashBalance", "Cash Balance")}
                  value={formatPosCash(detail.openingCash)}
                />
                <DetailRow
                  label={t("reports.shift.detail.cashPayments", "Cash Payments")}
                  value={formatPosCash(detail.cashSales)}
                />
                <DetailRow
                  label={t("reports.shift.detail.cashFromInvoice", "Cash from Invoices")}
                  value={formatPosCash(detail.cashFromInvoices)}
                />
                <DetailRow
                  label={t("reports.shift.detail.cashRefund", "Refund Cash")}
                  value={formatPosCash(detail.cashRefunds)}
                />
                <DetailRow
                  label={t("reports.shift.cashIo.title", "Cash Out / Cash In")}
                  value={formatPosCash(detail.cashInOutNet)}
                  onClick={() => setCashIoOpen(true)}
                />
                <DetailRow
                  label={t("reports.shift.detail.expectedCash", "Expected cash amount")}
                  value={formatPosCash(detail.expectedCash)}
                />
                {detail.status === "closed" && detail.closingCash != null ? (
                  <DetailRow
                    label={t("reports.shift.detail.countedCash", "Amount of cash received")}
                    value={formatPosCash(detail.closingCash)}
                    valueClassName={
                      isShiftShortage(detail.cashDifference) ? "text-rose-600" : undefined
                    }
                  />
                ) : null}
              </div>

              <SectionTitle>{t("reports.shift.detail.totalSection", "TOTAL")}</SectionTitle>
              <div className="overflow-hidden rounded-md border border-border">
                <DetailRow
                  label={t("reports.shift.detail.totalExpected", "Total expected")}
                  value={formatPosCash(detail.expectedCash)}
                />
                {detail.status === "closed" && detail.closingCash != null ? (
                  <>
                    <DetailRow
                      label={t("reports.shift.detail.totalActual", "Total actual")}
                      value={formatPosCash(detail.closingCash)}
                    />
                    <DetailRow
                      label={t("reports.shift.columns.difference", "Difference")}
                      value={formatShiftDifference(detail.cashDifference)}
                      valueClassName={
                        isShiftShortage(detail.cashDifference) ? "text-rose-600" : undefined
                      }
                    />
                  </>
                ) : null}
              </div>

              <div className="mt-4">
                <ShiftPaymentMethodsSection rows={detail.paymentMethods} />
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("reports.shift.detail.notFound", "Shift not found.")}
            </p>
          )}
        </SheetContent>
      </Sheet>

      {detail ? (
        <>
          <ShiftSoldItemsDialog
            open={soldOpen}
            onOpenChange={setSoldOpen}
            lines={soldLinesRaw}
            totalQty={detail.productsSoldQty}
          />
          <ShiftCashMovementsDialog
            open={cashIoOpen}
            onOpenChange={setCashIoOpen}
            movements={detail.cashMovements}
          />
        </>
      ) : null}
    </>
  );
}
