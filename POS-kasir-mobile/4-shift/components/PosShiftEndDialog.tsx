import { useEffect, useMemo, useState } from "react";
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
        "flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0",
        emphasize && "font-semibold",
      )}
    >
      <span className="min-w-0 flex-1 text-sm text-slate-800">{label}</span>
      <span className="flex-shrink-0 text-sm tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

/**
 * End Shift reconciliation modal — enter counted drawer cash vs expected.
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-lg [&>button]:hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onOpenChange(false)}
              className="border-primary text-primary"
            >
              {t(POS_SHIFT_I18N.cancel, "Cancel")}
            </Button>
            <DialogTitle className="flex-1 pr-16 text-center text-base font-semibold text-slate-900">
              {t(POS_SHIFT_I18N.endDialogTitle, "End Shift")}
            </DialogTitle>
          </div>

          <div className="px-4 py-3">
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <Row label={t(POS_SHIFT_I18N.detailOutlet, "Outlet")} value={outletName} />
              <Row
                label={t(POS_SHIFT_I18N.detailStarted, "Shift Started")}
                value={formatPosShiftDateTime(shift.opened_at, String(language ?? "id"))}
              />
              <Row
                label={t(POS_SHIFT_I18N.cashInOut, "Cash Out / Cash In")}
                value={String(Math.round(Math.abs(totals.cashInOutNet)) === 0 ? 0 : Math.round(totals.cashInOutNet))}
              />
            </div>

            <p className="px-1 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {t(POS_SHIFT_I18N.cashSection, "CASH")}
            </p>
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
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

            <div className="mt-4 overflow-hidden rounded-md border-2 border-primary/40 bg-white">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span className="flex-shrink-0 text-sm font-semibold text-slate-900">
                  {t(POS_SHIFT_I18N.countedCash, "Amount of cash received")}
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
                  <span className="text-sm text-slate-500">Rp</span>
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
                    className="w-full min-w-[7rem] max-w-[12rem] border-0 bg-transparent text-right text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
              </div>
              {hasInput ? (
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
                  <span className="text-sm text-slate-800">
                    {t(POS_SHIFT_I18N.variance, "Difference")}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-slate-900">
                    {formatPosShiftVariance(variance)}
                  </span>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              disabled={!hasInput || busy}
              onClick={submit}
              className="mt-4 h-12 w-full text-base font-semibold"
            >
              {t(POS_SHIFT_I18N.endShift, "End Shift")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmVarianceOpen} onOpenChange={setConfirmVarianceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(POS_SHIFT_I18N.varianceConfirmTitle, "Cash difference")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                POS_SHIFT_I18N.varianceConfirmDesc,
                "There is a difference of {{amount}}. The cashier is responsible for covering any shortage. Continue ending the shift?",
                { amount: formatPosShiftVariance(variance) },
              )}
            </AlertDialogDescription>
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
    </>
  );
}
