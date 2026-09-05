import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  formatIdrThousandsFromDigits,
  idrDigitsOnly,
  parseIdrInputToNumber,
} from "@/shared/lib/idrInputFormat";
import { cn } from "@/shared/lib/utils";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { POS_APP_FOOTER_OVERLAY_BOTTOM_CLASS } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { formatPosCash, formatPosCashOut } from "../lib/formatPosCash";
import { formatPosShiftDateTime } from "../lib/formatPosShiftDateTime";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import type { PosCashierShift, PosShiftTotals } from "../lib/posShiftTypes";
import {
  computePosShiftCashVariance,
  formatPosShiftVariance,
} from "../lib/posShiftVariance";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletName: string;
  displayName: string;
  shift: PosCashierShift;
  totals: PosShiftTotals;
  busy?: boolean;
  onConfirm: (countedCash: number) => void;
};

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0",
        emphasize && "font-semibold",
      )}
    >
      <span className="min-w-0 flex-1 pr-2 text-sm text-slate-800">{label}</span>
      <span className="max-w-[58%] min-w-0 shrink text-right text-sm tabular-nums text-slate-900 [overflow-wrap:anywhere]">
        {value}
      </span>
    </div>
  );
}

/**
 * End Shift reconciliation — full screen on phone, dialog on tablet.
 */
export function PosShiftEndDialog({
  open,
  onOpenChange,
  outletName,
  displayName: _displayName,
  shift,
  totals,
  busy,
  onConfirm,
}: Props) {
  const { t, language } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const [digits, setDigits] = useState("");
  const [confirmVarianceOpen, setConfirmVarianceOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setDigits("");
      setConfirmVarianceOpen(false);
    }
  }, [open]);

  const counted = parseIdrInputToNumber(digits);
  const hasInput = digits.length > 0 && Number.isFinite(counted) && counted >= 0;
  const variance = useMemo(
    () => (hasInput ? computePosShiftCashVariance(counted, totals.expectedCash) : 0),
    [counted, hasInput, totals.expectedCash],
  );

  const cashInOutDisplay =
    totals.cashInOutNet < 0
      ? formatPosCashOut(-totals.cashInOutNet)
      : formatPosCash(totals.cashInOutNet);

  const submit = () => {
    if (!hasInput || busy) return;
    if (variance !== 0) {
      setConfirmVarianceOpen(true);
      return;
    }
    onConfirm(counted);
  };

  const varianceConfirmDescription =
    variance < 0
      ? t(
          POS_SHIFT_I18N.varianceConfirmShortage,
          "Cash is short by {{amount}}. The cashier is responsible for covering the shortage. Continue ending the shift?",
          { amount: formatPosShiftVariance(variance) },
        )
      : t(
          POS_SHIFT_I18N.varianceConfirmOverage,
          "Cash is over by {{amount}}. This overage will be recorded on the shift. Continue ending the shift?",
          { amount: formatPosShiftVariance(variance) },
        );

  const titleText = t(POS_SHIFT_I18N.endDialogTitle, "End Shift");

  const header = (titleNode: ReactNode) => (
    <div className="relative flex shrink-0 items-center justify-center border-b border-slate-200 px-3 py-2.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => {
          if (busy) return;
          setConfirmVarianceOpen(false);
          onOpenChange(false);
        }}
        className="absolute left-3 top-1/2 -translate-y-1/2 border-primary text-primary"
      >
        {t(POS_SHIFT_I18N.cancel, "Cancel")}
      </Button>
      {titleNode}
    </div>
  );

  const body = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white">
          <Row label={t(POS_SHIFT_I18N.detailOutlet, "Outlet")} value={outletName} />
          <Row
            label={t(POS_SHIFT_I18N.detailStarted, "Shift Started")}
            value={formatPosShiftDateTime(shift.opened_at, String(language ?? "id"))}
          />
          <Row
            label={t(POS_SHIFT_I18N.cashInOut, "Cash Out / Cash In")}
            value={String(
              Math.round(Math.abs(totals.cashInOutNet)) === 0
                ? 0
                : Math.round(totals.cashInOutNet),
            )}
          />
        </div>

        <p className="px-1 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {t(POS_SHIFT_I18N.cashSection, "CASH")}
        </p>
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
            value={
              totals.cashRefunds > 0
                ? formatPosCashOut(totals.cashRefunds)
                : formatPosCash(0)
            }
          />
          <Row
            label={t(POS_SHIFT_I18N.cashInOut, "Cash Out / Cash In")}
            value={cashInOutDisplay}
          />
          <Row
            label={t(POS_SHIFT_I18N.expectedCash, "Expected cash amount")}
            value={formatPosCash(totals.expectedCash)}
            emphasize
          />
        </div>

        <div className="mt-4 min-w-0 overflow-hidden rounded-md border-2 border-primary/40 bg-white">
          <div className="flex min-w-0 flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="min-w-0 text-sm font-semibold text-slate-900">
              {t(POS_SHIFT_I18N.countedCash, "Amount of cash received")}
            </span>
            <div className="flex min-w-0 w-full items-center justify-end gap-1 sm:w-auto sm:max-w-[12rem] sm:flex-1">
              <span className="shrink-0 text-sm text-slate-500">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                disabled={busy}
                value={formatIdrThousandsFromDigits(digits)}
                onChange={(e) => setDigits(idrDigitsOnly(e.target.value))}
                placeholder={t(
                  POS_SHIFT_I18N.countedCashPlaceholder,
                  "Amount of cash received",
                )}
                className="min-w-0 w-full border-0 bg-transparent text-right text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
              />
            </div>
          </div>
          {hasInput ? (
            <div className="flex min-w-0 items-start justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <span className="min-w-0 flex-1 pr-2 text-sm text-slate-800">
                {t(POS_SHIFT_I18N.variance, "Difference")}
              </span>
              <span className="max-w-[58%] min-w-0 shrink text-right text-sm font-medium tabular-nums text-slate-900 [overflow-wrap:anywhere]">
                {formatPosShiftVariance(variance)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "shrink-0 border-t border-slate-100 p-3",
          /* Phone overlay already stops above the app footer (which owns safe-area). */
          !isPhone && "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <Button
          type="button"
          disabled={!hasInput || busy}
          onClick={submit}
          className="h-12 w-full text-base font-semibold"
        >
          {busy
            ? t(POS_SHIFT_I18N.endingShift, "Ending shift…")
            : t(POS_SHIFT_I18N.endShift, "End Shift")}
        </Button>
      </div>
    </div>
  );

  const varianceAlert = (
    <AlertDialog open={confirmVarianceOpen} onOpenChange={setConfirmVarianceOpen}>
      <AlertDialogContent
        // Phone End Shift overlay uses z-[60]; confirm must sit above it or focus trap locks the UI.
        className="z-[70]"
        overlayClassName="z-[70]"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(POS_SHIFT_I18N.varianceConfirmTitle, "Cash difference")}
          </AlertDialogTitle>
          <AlertDialogDescription>{varianceConfirmDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            {t(POS_SHIFT_I18N.cancel, "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={() => {
              setConfirmVarianceOpen(false);
              onConfirm(counted);
            }}
          >
            {t(POS_SHIFT_I18N.confirm, "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isPhone) {
    if (!open) {
      return varianceAlert;
    }
    /**
     * Portal to `document.body`: the shift phone slider uses `transform` /
     * `will-change-transform`, which would otherwise trap `position:fixed`
     * inside the pane (double status-bar spacer + gap above the footer).
     */
    return createPortal(
      <>
        <div
          className={cn(
            "fixed inset-x-0 top-0 z-[60] flex w-full max-w-[100dvw] flex-col overflow-x-hidden overflow-y-hidden bg-white",
            POS_APP_FOOTER_OVERLAY_BOTTOM_CLASS,
          )}
        >
          <PosSafeAreaTopSpacer />
          {header(
            <h1 className="min-w-0 truncate px-16 text-center text-base font-semibold text-slate-900">
              {titleText}
            </h1>,
          )}
          {body}
        </div>
        {varianceAlert}
      </>,
      document.body,
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg [&>button]:hidden">
          {header(
            <DialogTitle className="text-base font-semibold text-slate-900">
              {titleText}
            </DialogTitle>,
          )}
          {body}
        </DialogContent>
      </Dialog>
      {varianceAlert}
    </>
  );
}
