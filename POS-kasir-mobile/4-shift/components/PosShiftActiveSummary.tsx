import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatPosCash } from "../lib/formatPosCash";
import { formatPosShiftDateParts } from "../lib/formatPosShiftDateTime";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import type { PosCashierShift, PosShiftTotals } from "../lib/posShiftTypes";

type Props = {
  shift: PosCashierShift;
  totals: PosShiftTotals;
  outletName: string;
  displayName: string;
  refundedProductsQty?: number;
  /** Active = open shift; history = closed shift from History. */
  variant?: "active" | "history";
  onOpenCashIo: () => void;
  onOpenProductsSold: () => void;
};

function Row({
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
  const content = (
    <>
      <span className="min-w-0 flex-1 pr-2 text-sm text-slate-800">{label}</span>
      <span
        className={cn(
          "flex max-w-[58%] min-w-0 flex-shrink items-start justify-end gap-1 text-right text-sm font-medium text-slate-900",
          valueClassName,
        )}
      >
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{value}</span>
        {onClick ? (
          <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
        ) : null}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full min-w-0 items-start justify-between gap-2 border-b border-slate-200 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50"
      >
        {content}
      </button>
    );
  }
  return (
    <div className="flex w-full min-w-0 items-start justify-between gap-2 border-b border-slate-200 px-3 py-3 last:border-b-0">
      {content}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="px-0.5 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-600 first:pt-0">
      {children}
    </p>
  );
}

/** Active / history shift dashboard (gambar 4–7). */
export function PosShiftActiveSummary({
  shift,
  totals,
  outletName,
  displayName,
  variant = "active",
  onOpenCashIo,
  onOpenProductsSold,
  refundedProductsQty = 0,
}: Props) {
  const { t, language } = useAppTranslation();
  const isHistory = variant === "history";
  const expectedDisplay =
    isHistory && shift.expected_cash != null
      ? shift.expected_cash
      : totals.expectedCash;
  const countedDisplay = Math.round(shift.closing_cash ?? expectedDisplay);
  const countedShort = isHistory && countedDisplay < Math.round(expectedDisplay);
  const lang = String(language ?? "id");
  const startedParts = formatPosShiftDateParts(shift.opened_at, lang);
  const endedParts =
    isHistory && shift.closed_at
      ? formatPosShiftDateParts(shift.closed_at, lang)
      : null;

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden bg-slate-100 px-2 py-3 pb-8 sm:px-2.5">
      <SectionTitle>{t(POS_SHIFT_I18N.detailSection, "SHIFT DETAILS")}</SectionTitle>
      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm">
        <Row label={t(POS_SHIFT_I18N.detailName, "Name")} value={displayName} />
        <Row label={t(POS_SHIFT_I18N.detailOutlet, "Outlet")} value={outletName} />
        <Row
          label={t(POS_SHIFT_I18N.detailStarted, "Shift Started")}
          value={startedParts.dateLine}
        />
        <Row
          label={t(POS_SHIFT_I18N.detailStartedTime, "Time")}
          value={startedParts.timeLine}
        />
        {endedParts ? (
          <>
            <Row
              label={t(POS_SHIFT_I18N.endedClosedAt, "Shift Ended")}
              value={endedParts.dateLine}
            />
            <Row
              label={t(POS_SHIFT_I18N.detailStartedTime, "Time")}
              value={endedParts.timeLine}
            />
          </>
        ) : null}
        <Row
          label={t(POS_SHIFT_I18N.cashInOut, "Cash Out / Cash In")}
          value={String(Math.round(totals.cashInOutNet))}
          onClick={onOpenCashIo}
        />
      </div>

      <SectionTitle>{t(POS_SHIFT_I18N.orderSection, "ORDER DETAILS")}</SectionTitle>
      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm">
        <Row
          label={t(POS_SHIFT_I18N.productsSold, "Products Sold")}
          value={String(totals.productsSoldQty)}
          onClick={onOpenProductsSold}
        />
        <Row
          label={t(POS_SHIFT_I18N.productsRefund, "Refunded Products")}
          value={String(Math.round(refundedProductsQty))}
        />
      </div>

      <SectionTitle>{t(POS_SHIFT_I18N.cashSection, "CASH")}</SectionTitle>
      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm">
        <Row
          label={t(POS_SHIFT_I18N.cashBalance, "Cash Balance")}
          value={formatPosCash(totals.openingCash)}
        />
        <Row
          label={t(POS_SHIFT_I18N.cashPayments, "Cash Payments")}
          value={formatPosCash(totals.cashSales)}
        />
        <Row
          label={t(POS_SHIFT_I18N.cashFromInvoice, "Cash from Invoices")}
          value={formatPosCash(0)}
        />
        <Row
          label={t(POS_SHIFT_I18N.cashRefund, "Refund Cash")}
          value={formatPosCash(totals.cashRefunds)}
        />
        <Row
          label={t(POS_SHIFT_I18N.cashInOut, "Cash Out / Cash In")}
          value={formatPosCash(totals.cashInOutNet)}
          onClick={onOpenCashIo}
        />
        <Row
          label={t(POS_SHIFT_I18N.expectedCash, "Expected cash amount")}
          value={formatPosCash(expectedDisplay)}
        />
        {isHistory ? (
          <Row
            label={t(POS_SHIFT_I18N.countedCash, "Amount of cash received")}
            value={formatPosCash(countedDisplay)}
            valueClassName={countedShort ? "font-semibold text-rose-600" : undefined}
          />
        ) : null}
      </div>

      <SectionTitle>{t(POS_SHIFT_I18N.totalSection, "TOTAL:")}</SectionTitle>
      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-300/70 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
        <Row
          label={t(POS_SHIFT_I18N.totalExpected, "Total expected")}
          value={formatPosCash(expectedDisplay)}
        />
      </div>
    </div>
  );
}
