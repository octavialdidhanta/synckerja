import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { CogsRowDraft, VariantDraft } from "../types";

export type ManageProductCogsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  unit: string;
  variants: VariantDraft[];
  rows: CogsRowDraft[];
  lockCogs: boolean;
  onConfirm: (rows: CogsRowDraft[]) => void;
};

export function ManageProductCogsDialog({
  open,
  onOpenChange,
  productName,
  unit,
  variants,
  rows,
  lockCogs,
  onConfirm,
}: ManageProductCogsDialogProps) {
  const { t } = useAppTranslation();
  const [draft, setDraft] = useState(rows);

  useEffect(() => {
    if (!open) return;
    setDraft(rows);
  }, [open, rows]);

  const labelFor = (variantId: string | null) => {
    if (!variantId) return productName || "—";
    return variants.find((row) => row.id === variantId)?.name ?? productName;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("defaultPrices.product.cogs.title", "Manage Cost of Goods Sold (COGS)")}
          </DialogTitle>
        </div>
        <div className="px-4 py-3">
          <div className="grid grid-cols-[minmax(0,1.2fr)_auto_minmax(8rem,1fr)] items-end gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{t("defaultPrices.product.variant.column", "Variant")}</span>
            <span className="text-center">{t("defaultPrices.product.cogs.track", "Track COGS")}</span>
            <span>{t("defaultPrices.product.cogs.avgCost", "Avg Cost")}</span>
          </div>
          {draft.map((row, index) => (
            <div
              key={row.variantId ?? "base"}
              className="mt-2 grid grid-cols-[minmax(0,1.2fr)_auto_minmax(8rem,1fr)] items-center gap-3"
            >
              <span className="truncate text-sm">{labelFor(row.variantId)}</span>
              <div className="flex justify-center">
                <Checkbox
                  checked={lockCogs || row.trackCogs}
                  disabled={lockCogs}
                  onCheckedChange={(checked) =>
                    setDraft((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, trackCogs: checked === true } : item)),
                    )
                  }
                />
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  Rp
                </span>
                <Input
                  inputMode="numeric"
                  value={row.avgCost}
                  disabled={lockCogs}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, avgCost: e.target.value.replace(/[^\d]/g, "") } : item,
                      ),
                    )
                  }
                  className="h-9 pl-8"
                />
              </div>
            </div>
          ))}
          <p className="mt-2 text-xs text-muted-foreground">{unit}</p>
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <p className="flex-1 text-center text-xs italic text-muted-foreground">
            {t("defaultPrices.product.cogs.hint", "*Use the Purchase Order Page to manage Avg Cost")}
          </p>
          <Button
            type="button"
            onClick={() => {
              onConfirm(draft);
              onOpenChange(false);
            }}
          >
            {t("defaultPrices.product.inventory.confirm", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
