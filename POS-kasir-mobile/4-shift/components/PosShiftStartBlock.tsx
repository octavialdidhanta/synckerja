import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  formatIdrThousandsFromDigits,
  idrDigitsOnly,
  parseIdrInputToNumber,
} from "@/shared/lib/idrInputFormat";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";

type Props = {
  defaultOpeningCash: number;
  busy?: boolean;
  onStart: (openingCash: number) => Promise<void>;
};

/** Empty current-shift: Saldo Tunai + Mulai Shift (gambar 3). */
export function PosShiftStartBlock({ defaultOpeningCash, busy, onStart }: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const [cashDigits, setCashDigits] = useState(() =>
    String(Math.round(defaultOpeningCash || 0)),
  );

  useEffect(() => {
    setCashDigits(String(Math.round(defaultOpeningCash || 0)));
  }, [defaultOpeningCash]);

  const handleStart = async () => {
    const amount = parseIdrInputToNumber(cashDigits);
    try {
      await onStart(Number.isFinite(amount) ? Math.max(0, amount) : 0);
    } catch {
      toast({
        title: t(POS_SHIFT_I18N.startFailed, "Failed to start shift."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-full min-w-0 flex-col overflow-x-hidden bg-slate-100 px-2 py-4 sm:px-2.5">
      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-3 py-3.5">
          <span className="min-w-0 flex-shrink text-sm text-slate-900">
            {t(POS_SHIFT_I18N.openingCash, "Cash Balance")}
          </span>
          <div className="flex min-w-0 max-w-[55%] items-center gap-1">
            <span className="flex-shrink-0 text-sm text-slate-500">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              disabled={busy}
              value={formatIdrThousandsFromDigits(cashDigits)}
              onChange={(e) => setCashDigits(idrDigitsOnly(e.target.value) || "0")}
              className="min-w-0 flex-1 border-0 bg-transparent text-right text-sm font-medium text-slate-900 outline-none"
            />
          </div>
        </div>
      </div>

      <Button
        type="button"
        disabled={busy}
        onClick={() => void handleStart()}
        className="mt-6 h-12 w-full text-base font-bold uppercase tracking-wide shadow-sm"
      >
        {t(POS_SHIFT_I18N.startShift, "Start Shift")}
      </Button>
    </div>
  );
}
