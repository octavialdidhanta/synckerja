import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  aggregatePosShiftProductsSold,
  type PosShiftSoldLineRaw,
} from "@/shared/pos-shift";
import { useMemo } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: PosShiftSoldLineRaw[];
  totalQty: number;
};

export function ShiftSoldItemsDialog({ open, onOpenChange, lines, totalQty }: Props) {
  const { t } = useAppTranslation();
  const aggregated = useMemo(() => aggregatePosShiftProductsSold(lines), [lines]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("reports.shift.soldItems.title", "Sold Items")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("reports.shift.soldItems.total", "Total Items: {{count}}", {
            count: totalQty || aggregated.totalQty,
          })}
        </p>
        <div className="overflow-hidden rounded-md border border-border">
          <div className="grid grid-cols-2 gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>{t("reports.shift.soldItems.item", "Item")}</span>
            <span className="text-right">
              {t("reports.shift.soldItems.quantity", "Quantity")}
            </span>
          </div>
          {aggregated.rows.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">—</p>
          ) : (
            aggregated.rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-2 gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0"
              >
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="text-right tabular-nums">{row.quantity}</span>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close", "Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
