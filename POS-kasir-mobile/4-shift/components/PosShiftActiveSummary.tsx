import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { formatPosCash } from "../lib/formatPosCash";
import { formatPosShiftDateTime } from "../lib/formatPosShiftDateTime";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import type { PosCashierShift, PosShiftTotals } from "../lib/posShiftTypes";

type Props = {
  shift: PosCashierShift;
  totals: PosShiftTotals;
  outletName: string;
  displayName: string;
  refundedProductsQty?: number;
  busy?: boolean;
  /** Active = End+Print; history = Print only + closed/counted rows. */
  variant?: "active" | "history";
  onEnd: () => void;
  onPrint: () => void;
  onOpenCashIo: () => void;
  onOpenProductsSold: () => void;
};

function formatStartedAt(
  iso: string,
  t: (key: string, fallback: string, vars?: Record<string, string>) => string,
  language: string,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = language.startsWith("en") ? "en-US" : "id-ID";
  const weekday = d.toLocaleDateString(locale, { weekday: "long" });
  const date = d.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return t(POS_SHIFT_I18N.startedAt, "{{weekday}}, {{date}} at {{time}}", {
    weekday,
    date,
    time,
  });
}

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
        className="flex w-full min-w-0 items-start justify-between gap-2 border-b border-slate-100 px-3 py-3.5 text-left last:border-b-0 hover:bg-slate-50 sm:gap-3 sm:px-4"
      >
        {content}
      </button>
    );
  }
  return (
    <div className="flex w-full min-w-0 items-start justify-between gap-2 border-b border-slate-100 px-3 py-3.5 last:border-b-0 sm:gap-3 sm:px-4">
      {content}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wide text-slate-500 first:pt-0">
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
  busy,
  variant = "active",
  onEnd,
  onPrint,
  onOpenCashIo,
  onOpenProductsSold,
  refundedProductsQty = 0,
}: Props) {
  const { t, language } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const isHistory = variant === "history";
  const expectedDisplay =
    isHistory && shift.expected_cash != null
      ? shift.expected_cash
      : totals.expectedCash;
  const countedDisplay = Math.round(shift.closing_cash ?? expectedDisplay);
  const countedShort = isHistory && countedDisplay < Math.round(expectedDisplay);

  return (
    <div className="min-w-0 overflow-x-hidden px-3 py-4 pb-10 sm:px-4">
      {isHistory ? (
        <div className="mb-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onPrint}
            className="h-12 w-full text-sm font-semibold"
          >
            {t(POS_SHIFT_I18N.printReport, "Print Shift Report")}
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "mb-4 grid gap-3",
            isPhone ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onEnd}
            className="h-12 text-sm font-semibold"
          >
            {t(POS_SHIFT_I18N.endShift, "End Shift")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onPrint}
            className="h-12 text-sm font-semibold"
          >
            {t(POS_SHIFT_I18N.printReport, "Print Shift Report")}
          </Button>
        </div>
      )}

      <SectionTitle>{t(POS_SHIFT_I18N.detailSection, "SHIFT DETAILS")}</SectionTitle>
      <div className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white">
        <Row label={t(POS_SHIFT_I18N.detailName, "Name")} value={displayName} />
        <Row label={t(POS_SHIFT_I18N.detailOutlet, "Outlet")} value={outletName} />
        <Row
          label={t(POS_SHIFT_I18N.detailStarted, "Shift Started")}
          value={formatStartedAt(shift.opened_at, t, String(language ?? "id"))}
        />
        {isHistory && shift.closed_at ? (
          <Row
            label={t(POS_SHIFT_I18N.endedClosedAt, "Shift Ended")}
            value={formatPosShiftDateTime(shift.closed_at, String(language ?? "id"))}
          />
        ) : null}
        <Row
          label={t(POS_SHIFT_I18N.cashInOut, "Cash Out / Cash In")}
          value={String(Math.round(totals.cashInOutNet))}
          onClick={onOpenCashIo}
        />
      </div>

      <SectionTitle>{t(POS_SHIFT_I18N.orderSection, "ORDER DETAILS")}</SectionTitle>
      <div className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white">
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
      <div className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white">
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
      <div className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white">
        <Row
          label={t(POS_SHIFT_I18N.totalExpected, "Total expected")}
          value={formatPosCash(expectedDisplay)}
        />
      </div>
    </div>
  );
}
