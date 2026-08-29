import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatGrossProfitMoney } from "../lib/computeGrossProfitDisplay";
import type { GrossProfitCogsAdjustment } from "../lib/grossProfitCogsAdjustmentTypes";
import {
  useGrossProfitCogsAdjustmentMutations,
  useGrossProfitCogsAdjustments,
} from "../hooks/useGrossProfitCogsAdjustments";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletId: string | null;
  outletLabel: string;
  fromYmd: string;
  toYmd: string;
};

export function GrossProfitCogsAdjustmentSheet({
  open,
  onOpenChange,
  outletId,
  outletLabel,
  fromYmd,
  toYmd,
}: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState(fromYmd);
  const [localError, setLocalError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useGrossProfitCogsAdjustments({
    outletId,
    fromYmd,
    toYmd,
    enabled: open,
  });
  const { create, remove } = useGrossProfitCogsAdjustmentMutations();

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setReason("");
    setAdjustmentDate(fromYmd);
    setLocalError(null);
  }, [open, fromYmd]);

  const handleCreate = async () => {
    const parsed = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed === 0) {
      setLocalError(
        t("reports.grossProfit.cogsAdjustment.amountRequired", "Enter a non-zero amount."),
      );
      return;
    }
    if (!adjustmentDate) {
      setLocalError(
        t("reports.grossProfit.cogsAdjustment.dateRequired", "Adjustment date is required."),
      );
      return;
    }
    setLocalError(null);
    try {
      await create.mutateAsync({
        amount: parsed,
        reason,
        adjustmentDate,
        posOutletId: outletId,
      });
      toast({
        title: t("reports.grossProfit.cogsAdjustment.saved", "COGS adjustment saved."),
      });
      setAmount("");
      setReason("");
    } catch (err) {
      toast({
        title:
          err instanceof Error
            ? err.message
            : t("reports.grossProfit.cogsAdjustment.saveFailed", "Failed to save adjustment."),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (row: GrossProfitCogsAdjustment) => {
    try {
      await remove.mutateAsync(row.id);
      toast({
        title: t("reports.grossProfit.cogsAdjustment.deleted", "COGS adjustment removed."),
      });
    } catch (err) {
      toast({
        title:
          err instanceof Error
            ? err.message
            : t("reports.grossProfit.cogsAdjustment.deleteFailed", "Failed to remove adjustment."),
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {t("reports.grossProfit.cogsAdjustment.title", "COGS Adjustments")}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {outletLabel} · {fromYmd} – {toYmd}
          </p>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
          <p className="text-xs text-muted-foreground">
            {t(
              "reports.grossProfit.cogsAdjustment.help",
              "Manual corrections to COGS for this period (Moka-style). Positive amount increases COGS and reduces Gross Profit.",
            )}
          </p>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("reports.grossProfit.cogsAdjustment.loading", "Loading adjustments…")}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "reports.grossProfit.cogsAdjustment.empty",
                "No adjustments in this period.",
              )}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {rows.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium tabular-nums">
                      {formatGrossProfitMoney(row.amount, {
                        asDeduction: row.amount > 0,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.adjustmentDate}</p>
                    {row.reason ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.reason}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={remove.isPending}
                    onClick={() => void handleDelete(row)}
                    aria-label={t("reports.grossProfit.cogsAdjustment.delete", "Remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-sm font-medium">
              {t("reports.grossProfit.cogsAdjustment.addTitle", "Add adjustment")}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="gp-cogs-adj-amount">
                {t("reports.grossProfit.cogsAdjustment.amountLabel", "Amount (IDR)")}
              </Label>
              <Input
                id="gp-cogs-adj-amount"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gp-cogs-adj-date">
                {t("reports.grossProfit.cogsAdjustment.dateLabel", "Date")}
              </Label>
              <Input
                id="gp-cogs-adj-date"
                type="date"
                value={adjustmentDate}
                min={fromYmd}
                max={toYmd}
                onChange={(e) => setAdjustmentDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gp-cogs-adj-reason">
                {t("reports.grossProfit.cogsAdjustment.reasonLabel", "Reason (optional)")}
              </Label>
              <Input
                id="gp-cogs-adj-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {localError ? <p className="text-xs text-destructive">{localError}</p> : null}
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close", "Close")}
          </Button>
          <Button type="button" disabled={create.isPending} onClick={() => void handleCreate()}>
            {t("reports.grossProfit.cogsAdjustment.save", "Save adjustment")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
