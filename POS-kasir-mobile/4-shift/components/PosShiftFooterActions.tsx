import { LogOut, Printer } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";

type Props = {
  busy?: boolean;
  /** When true, only Print is shown (e.g. closed Shift Detail from History). */
  printOnly?: boolean;
  /** When true, End is the confirm action for the open End Shift sheet. */
  endConfirmPhase?: boolean;
  /** Disable only the End tab (e.g. confirm phase before cash amount is entered). */
  endDisabled?: boolean;
  onEnd?: () => void;
  onPrint: () => void;
  className?: string;
};

/** Flat End + Print for the blue app footer — matches cashier bottom nav. */
export function PosShiftFooterActions({
  busy,
  printOnly,
  endConfirmPhase,
  endDisabled,
  onEnd,
  onPrint,
  className,
}: Props) {
  const { t } = useAppTranslation();

  const actionClass = (active?: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-center text-xs font-semibold text-white transition-colors sm:text-sm",
      active
        ? "bg-white/25"
        : "bg-transparent hover:bg-white/15 active:bg-white/20",
      "disabled:opacity-50",
    );

  if (printOnly) {
    return (
      <div className={cn("flex min-h-14 min-w-0 flex-1 items-stretch", className)}>
        <button
          type="button"
          disabled={busy}
          onClick={onPrint}
          className={actionClass(false)}
        >
          <Printer className="h-4 w-4" aria-hidden />
          {t(POS_SHIFT_I18N.printReport, "Print Shift Report")}
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-14 min-w-0 flex-1 items-stretch", className)}>
      <button
        type="button"
        disabled={busy || endDisabled}
        onClick={onEnd}
        className={actionClass(endConfirmPhase)}
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {busy && endConfirmPhase
          ? t(POS_SHIFT_I18N.endingShift, "Ending shift…")
          : t(POS_SHIFT_I18N.endShift, "End Shift")}
      </button>
      <div className="w-px flex-shrink-0 self-stretch bg-white/25" aria-hidden />
      <button
        type="button"
        disabled={busy || endConfirmPhase}
        onClick={onPrint}
        className={actionClass(false)}
      >
        <Printer className="h-4 w-4" aria-hidden />
        {t(POS_SHIFT_I18N.printReport, "Print Shift Report")}
      </button>
    </div>
  );
}
