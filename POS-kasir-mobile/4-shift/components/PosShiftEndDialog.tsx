import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
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
import { usePosKeyboardShellStyle } from "@/pos-mobile/shared/hooks/usePosKeyboardShellStyle";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { formatPosCash, formatPosCashOut } from "../lib/formatPosCash";
import { formatPosShiftDateParts } from "../lib/formatPosShiftDateTime";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import { POS_SHIFT_PANEL } from "../lib/posShiftPanelChrome";
import type { PosCashierShift, PosShiftTotals } from "../lib/posShiftTypes";
import {
  computePosShiftCashVariance,
  formatPosShiftVariance,
} from "../lib/posShiftVariance";

export type PosShiftEndSubmitState = {
  canSubmit: boolean;
  submit: () => void;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletName: string;
  displayName: string;
  shift: PosCashierShift;
  totals: PosShiftTotals;
  busy?: boolean;
  onConfirm: (countedCash: number) => void;
  /**
   * Hide in-dialog End Shift CTA; drive confirm from the blue footer instead.
   * Reports canSubmit/submit via onExternalSubmitStateChange while open.
   */
  confirmViaFooter?: boolean;
  onExternalSubmitStateChange?: (state: PosShiftEndSubmitState | null) => void;
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
        POS_SHIFT_PANEL.row,
        "items-start",
        emphasize && "font-semibold",
      )}
    >
      <span className={cn(POS_SHIFT_PANEL.rowLabel, "pr-2")}>{label}</span>
      <span
        className={cn(
          "max-w-[58%] min-w-0 shrink text-right text-sm tabular-nums text-slate-900 [overflow-wrap:anywhere]",
          emphasize ? "font-semibold" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * End Shift reconciliation — full screen on phone, dialog on tablet.
 * With `confirmViaFooter`, primary confirm lives on the app footer End Shift tab.
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
  confirmViaFooter = false,
  onExternalSubmitStateChange,
}: Props) {
  const { t, language } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const keyboardShellStyle = usePosKeyboardShellStyle();
  const [digits, setDigits] = useState("");
  const [confirmVarianceOpen, setConfirmVarianceOpen] = useState(false);

  /**
   * Pin to the visible viewport (same as the shift shell) so the overlay does not
   * stay glued to the layout bottom behind the IME while the blue footer moves up.
   * Height stops at the `min-h-14` footer row so End Shift stays tappable.
   */
  const overlayPinStyle = useMemo((): CSSProperties | undefined => {
    if (!keyboardShellStyle) return undefined;
    const height = keyboardShellStyle.height;
    if (typeof height !== "number") return keyboardShellStyle;
    const aboveFooter = Math.max(0, height - 56);
    return {
      ...keyboardShellStyle,
      height: aboveFooter,
      maxHeight: aboveFooter,
    };
  }, [keyboardShellStyle]);

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

  const startedParts = formatPosShiftDateParts(
    shift.opened_at,
    String(language ?? "id"),
  );

  const submit = () => {
    if (!hasInput || busy) return;
    if (variance !== 0) {
      setConfirmVarianceOpen(true);
      return;
    }
    onConfirm(counted);
  };

  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (!confirmViaFooter || !onExternalSubmitStateChange) return;
    if (!open) {
      onExternalSubmitStateChange(null);
      return () => onExternalSubmitStateChange(null);
    }
    onExternalSubmitStateChange({
      canSubmit: hasInput && !busy,
      submit: () => submitRef.current(),
    });
    return () => onExternalSubmitStateChange(null);
  }, [confirmViaFooter, onExternalSubmitStateChange, open, hasInput, busy]);

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

  const close = () => {
    if (busy) return;
    setConfirmVarianceOpen(false);
    onOpenChange(false);
  };

  const headerBar = (
    <div className={POS_SHIFT_PANEL.header}>
      <button
        type="button"
        disabled={busy}
        onClick={close}
        className={POS_SHIFT_PANEL.headerBack}
        aria-label={t(POS_SHIFT_I18N.back, "Back")}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      {isPhone ? (
        <h1 className={POS_SHIFT_PANEL.headerTitle}>{titleText}</h1>
      ) : (
        <DialogTitle className={POS_SHIFT_PANEL.headerTitle}>{titleText}</DialogTitle>
      )}
    </div>
  );

  const countedCashCard = (
    <div
      className={cn(
        POS_SHIFT_PANEL.card,
        "border-2 border-primary/40 shadow-sm",
      )}
    >
      <div className="flex min-w-0 flex-col gap-2 px-3 py-3">
        <span className="min-w-0 text-sm font-semibold text-slate-900">
          {t(POS_SHIFT_I18N.countedCash, "Amount of cash received")}
        </span>
        <div className="flex min-w-0 w-full items-center justify-end gap-1">
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
        <div className={cn(POS_SHIFT_PANEL.row, "border-b-0 border-t border-slate-200")}>
          <span className={cn(POS_SHIFT_PANEL.rowLabel, "pr-2")}>
            {t(POS_SHIFT_I18N.variance, "Difference")}
          </span>
          <span className="max-w-[58%] min-w-0 shrink text-right text-sm font-medium tabular-nums text-slate-900 [overflow-wrap:anywhere]">
            {formatPosShiftVariance(variance)}
          </span>
        </div>
      ) : null}
    </div>
  );

  const body = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
      <div
        className={cn(
          "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden",
          POS_SHIFT_PANEL.body,
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        <div className={POS_SHIFT_PANEL.card}>
          <Row label={t(POS_SHIFT_I18N.detailOutlet, "Outlet")} value={outletName} />
          <Row
            label={t(POS_SHIFT_I18N.detailStarted, "Shift Started")}
            value={startedParts.dateLine}
          />
          <Row
            label={t(POS_SHIFT_I18N.detailStartedTime, "Time")}
            value={startedParts.timeLine}
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

        <p className={POS_SHIFT_PANEL.sectionTitle}>
          {t(POS_SHIFT_I18N.cashSection, "CASH")}
        </p>
        <div className={POS_SHIFT_PANEL.card}>
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

        {/* Tablet / non-docked: keep amount in scroll flow */}
        {!isPhone ? <div className="mt-3">{countedCashCard}</div> : null}
      </div>

      {/* Phone: dock amount above app footer; height tracks adjustResize (no bottom flip). */}
      {isPhone ? (
        <div className="shrink-0 border-t border-slate-200/80 bg-slate-100 px-2 pb-2 pt-2 sm:px-2.5">
          {countedCashCard}
        </div>
      ) : null}

      {confirmViaFooter ? null : (
        <div
          className={cn(
            "shrink-0 border-t border-slate-200 bg-white p-3",
            !isPhone && "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
        >
          <Button
            type="button"
            disabled={!hasInput || busy}
            onClick={submit}
            className="h-11 w-full text-sm font-semibold"
          >
            {busy
              ? t(POS_SHIFT_I18N.endingShift, "Ending shift…")
              : t(POS_SHIFT_I18N.endShift, "End Shift")}
          </Button>
        </div>
      )}
    </div>
  );

  const varianceAlert = (
    <AlertDialog open={confirmVarianceOpen} onOpenChange={setConfirmVarianceOpen}>
      <AlertDialogContent
        className="z-[70] rounded-2xl sm:rounded-2xl"
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
    return createPortal(
      <>
        <div
          className={cn(
            "fixed inset-x-0 top-0 z-[60] flex w-full max-w-[100dvw] flex-col overflow-x-hidden overflow-y-hidden overscroll-none bg-slate-100",
            /* Flush with the blue footer; collapse inset with `data-keyboard-open` so no hole. */
            !overlayPinStyle &&
              "bottom-[calc(3.5rem+max(var(--footer-bottom-inset,0px),var(--safe-area-inset-bottom,0px),env(safe-area-inset-bottom,0px)))] [html[data-keyboard-open]_&]:bottom-14",
          )}
          style={overlayPinStyle}
        >
          <PosSafeAreaTopSpacer className="bg-white" />
          {headerBar}
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
          {headerBar}
          {body}
        </DialogContent>
      </Dialog>
      {varianceAlert}
    </>
  );
}
