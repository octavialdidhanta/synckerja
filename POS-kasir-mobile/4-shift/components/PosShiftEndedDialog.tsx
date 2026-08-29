import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatPosShiftDateTime } from "../lib/formatPosShiftDateTime";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import type { PosCashierShift } from "../lib/posShiftTypes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletName: string;
  displayName: string;
  shift: PosCashierShift;
  printing?: boolean;
  onPrint: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0">
      <span className="min-w-0 flex-1 text-sm text-slate-800">{label}</span>
      <span className="flex-shrink-0 text-right text-sm text-slate-900">{value}</span>
    </div>
  );
}

/** Success modal after shift is closed — print recap or dismiss. */
export function PosShiftEndedDialog({
  open,
  onOpenChange,
  outletName,
  displayName,
  shift,
  printing,
  onPrint,
}: Props) {
  const { t, language } = useAppTranslation();
  const lang = String(language ?? "id");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md [&>button]:hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary">
            {t(POS_SHIFT_I18N.endedTitle, "Shift Ended")}
          </DialogTitle>
        </div>

        <div className="px-4 py-3">
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <Row label={t(POS_SHIFT_I18N.detailName, "Name")} value={displayName} />
            <Row label={t(POS_SHIFT_I18N.detailOutlet, "Outlet")} value={outletName} />
            <Row
              label={t(POS_SHIFT_I18N.detailStarted, "Shift Started")}
              value={formatPosShiftDateTime(shift.opened_at, lang, {
                includeWeekday: false,
              })}
            />
            <Row
              label={t(POS_SHIFT_I18N.endedClosedAt, "Shift Ended")}
              value={
                shift.closed_at
                  ? formatPosShiftDateTime(shift.closed_at, lang, {
                      includeWeekday: false,
                    })
                  : "—"
              }
            />
          </div>

          <Button
            type="button"
            disabled={printing}
            onClick={onPrint}
            className="mt-5 h-12 w-full text-sm font-semibold"
          >
            {t(POS_SHIFT_I18N.printRecap, "Print Shift Report Summary")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={printing}
            onClick={() => onOpenChange(false)}
            className="mt-3 h-12 w-full text-sm font-semibold"
          >
            {t(POS_SHIFT_I18N.noThanks, "No, Thank You")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
