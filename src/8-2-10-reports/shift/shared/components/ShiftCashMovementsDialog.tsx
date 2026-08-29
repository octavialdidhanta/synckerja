import { format, parseISO } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatPosCash, formatPosCashOut } from "@/shared/pos-shift";
import type { ShiftCashMovementRow } from "../lib/shiftTypes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movements: ShiftCashMovementRow[];
};

function formatWhen(iso: string): string {
  try {
    return format(parseISO(iso), "dd MMM yyyy HH:mm");
  } catch {
    return iso;
  }
}

export function ShiftCashMovementsDialog({ open, onOpenChange, movements }: Props) {
  const { t } = useAppTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("reports.shift.cashIo.title", "Cash Out / Cash In")}
          </DialogTitle>
        </DialogHeader>
        {movements.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("reports.shift.cashIo.empty", "No cash movements recorded.")}
          </p>
        ) : (
          <div className="max-h-[360px] overflow-y-auto rounded-md border border-border">
            {movements.map((m) => (
              <div
                key={m.id}
                className="flex items-start justify-between gap-3 border-b border-border px-3 py-2.5 text-sm last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">
                    {m.direction === "in"
                      ? t("reports.shift.cashIo.in", "Cash In")
                      : t("reports.shift.cashIo.out", "Cash Out")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.description || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatWhen(m.createdAt)}</p>
                </div>
                <span className="shrink-0 tabular-nums font-medium">
                  {m.direction === "out"
                    ? formatPosCashOut(m.amount)
                    : formatPosCash(m.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close", "Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
