import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  formatIdrThousandsFromDigits,
  idrDigitsOnly,
  parseIdrInputToNumber,
} from "@/shared/lib/idrInputFormat";
import { cn } from "@/shared/lib/utils";
import { formatPosCash, formatPosCashOut } from "../lib/formatPosCash";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import type { PosCashMovement, PosCashMovementDirection } from "../lib/posShiftTypes";
import { usePosCashierShiftActions } from "../lib/usePosCashierShift";

type Props = {
  shiftId: string;
  outletId: string;
  movements: PosCashMovement[];
  onBack: () => void;
  /** History detail: hide add form, list only. */
  readOnly?: boolean;
};

/**
 * Kas Keluar / Kas Masuk form + list (gambar 8–10).
 * Flow: fill → Kirim (preview confirm) → Konfirmasi.
 */
export function PosShiftCashMovementPanel({
  shiftId,
  outletId,
  movements,
  onBack,
  readOnly = false,
}: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { addMovement, isAddingMovement } = usePosCashierShiftActions(outletId);

  const [description, setDescription] = useState("");
  const [direction, setDirection] = useState<PosCashMovementDirection>("in");
  const [amountDigits, setAmountDigits] = useState("");
  const [confirming, setConfirming] = useState(false);

  const amount = parseIdrInputToNumber(amountDigits);
  const canSubmit =
    description.trim().length > 0 && Number.isFinite(amount) && amount > 0;

  const netTotal = useMemo(
    () =>
      movements.reduce(
        (sum, m) => sum + (m.direction === "in" ? m.amount : -m.amount),
        0,
      ),
    [movements],
  );

  const resetForm = () => {
    setDescription("");
    setAmountDigits("");
    setDirection("in");
    setConfirming(false);
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    try {
      await addMovement({
        shiftId,
        direction,
        amount,
        description: description.trim(),
      });
      toast({ title: t(POS_SHIFT_I18N.movementAdded, "Cash movement recorded.") });
      resetForm();
    } catch {
      toast({
        title: t(POS_SHIFT_I18N.movementFailed, "Failed to record cash movement."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1.5 text-primary hover:bg-slate-100"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="flex-1 pr-8 text-center text-base font-semibold text-slate-900">
          {t(POS_SHIFT_I18N.cashIoTitle, "Cash Out / Cash In")}
        </h2>
      </div>

      <div className="flex-1 px-4 py-4 pb-8">
        {readOnly ? null : (
          <>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
            <span className="flex-shrink-0 text-sm text-slate-700">
              {t(POS_SHIFT_I18N.description, "Description")}
            </span>
            <input
              type="text"
              value={description}
              disabled={confirming || isAddingMovement}
              onChange={(e) => {
                setDescription(e.target.value);
                setConfirming(false);
              }}
              placeholder={t(POS_SHIFT_I18N.descriptionPlaceholder, "Enter description")}
              className="min-w-0 flex-1 border-0 bg-transparent text-right text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <button
              type="button"
              disabled={isAddingMovement}
              onClick={() => {
                setDirection("in");
                setConfirming(false);
              }}
              className={cn(
                "rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide text-white",
                direction === "in" ? "bg-emerald-500" : "bg-slate-300",
              )}
            >
              {t(POS_SHIFT_I18N.cashIn, "CASH IN")}
            </button>
            <button
              type="button"
              disabled={isAddingMovement}
              onClick={() => {
                setDirection("out");
                setConfirming(false);
              }}
              className={cn(
                "rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide text-white",
                direction === "out" ? "bg-rose-500" : "bg-slate-300",
              )}
            >
              {t(POS_SHIFT_I18N.cashOut, "CASH OUT")}
            </button>
            <div className="ml-auto flex items-center gap-1">
              <span className="text-sm text-slate-500">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                disabled={confirming || isAddingMovement}
                value={formatIdrThousandsFromDigits(amountDigits)}
                onChange={(e) => {
                  setAmountDigits(idrDigitsOnly(e.target.value));
                  setConfirming(false);
                }}
                placeholder={t(POS_SHIFT_I18N.amountPlaceholder, "Enter amount")}
                className="w-32 border-0 bg-transparent text-right text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        <Button
          type="button"
          disabled={!canSubmit || isAddingMovement}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            void handleConfirm();
          }}
          className="mt-4 h-12 w-full text-base font-bold uppercase"
        >
          {confirming
            ? t(POS_SHIFT_I18N.confirm, "Confirm")
            : t(POS_SHIFT_I18N.send, "Send")}
        </Button>
          </>
        )}

        <p className={cn("mb-2 text-sm font-medium text-slate-500", readOnly ? "mt-0" : "mt-8")}>
          {t(POS_SHIFT_I18N.cashIoListTitle, "Cash Out / Cash In")}
        </p>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          {movements.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">—</p>
          ) : (
            movements.map((m) => {
              const time = new Date(m.created_at).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                >
                  <span className="text-sm text-slate-800">
                    {time} - {m.description}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      m.direction === "out" ? "text-rose-600" : "text-emerald-600",
                    )}
                  >
                    {m.direction === "out"
                      ? formatPosCashOut(m.amount)
                      : formatPosCash(m.amount)}
                  </span>
                </div>
              );
            })
          )}
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-800">
              {t(POS_SHIFT_I18N.cashIoTotal, "Total Cash Out/Cash In")}
            </span>
            <span
              className={cn(
                "text-sm font-semibold",
                netTotal < 0 ? "text-rose-600" : "text-slate-900",
              )}
            >
              {netTotal < 0 ? formatPosCashOut(-netTotal) : formatPosCash(netTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
