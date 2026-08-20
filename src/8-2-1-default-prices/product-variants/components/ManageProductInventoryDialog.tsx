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
import type { InventoryRowDraft, VariantDraft } from "../types";

export type ManageProductInventoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  unit: string;
  variants: VariantDraft[];
  rows: InventoryRowDraft[];
  lockTracking: boolean;
  onConfirm: (rows: InventoryRowDraft[]) => void;
};

export function ManageProductInventoryDialog({
  open,
  onOpenChange,
  productName,
  unit,
  variants,
  rows,
  lockTracking,
  onConfirm,
}: ManageProductInventoryDialogProps) {
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
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("defaultPrices.product.inventory.title", "Manage Inventory")}
          </DialogTitle>
        </div>
        <div className="overflow-x-auto px-4 py-3">
          <div className="grid min-w-[640px] grid-cols-[minmax(0,1.2fr)_auto_auto_auto_auto] items-end gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{t("defaultPrices.product.variant.column", "Variant")}</span>
            <span className="text-center">{t("defaultPrices.product.inventory.trackStock", "Track Stock")}</span>
            <span>{t("defaultPrices.product.inventory.inStock", "In Stock")}</span>
            <span className="text-center">{t("defaultPrices.product.inventory.alert", "Alert")}</span>
            <span>{t("defaultPrices.product.inventory.alertAt", "Alert at")}</span>
          </div>
          {draft.map((row, index) => (
            <div
              key={row.variantId ?? "base"}
              className="mt-2 grid min-w-[640px] grid-cols-[minmax(0,1.2fr)_auto_auto_auto_auto] items-center gap-3"
            >
              <span className="truncate text-sm">{labelFor(row.variantId)}</span>
              <div className="flex justify-center">
                <Checkbox
                  checked={lockTracking || row.trackStock}
                  disabled={lockTracking}
                  onCheckedChange={(checked) =>
                    setDraft((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, trackStock: checked === true } : item)),
                    )
                  }
                />
              </div>
              <Input
                inputMode="decimal"
                value={row.inStock}
                disabled={lockTracking}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, inStock: e.target.value.replace(/[^\d.]/g, "") } : item,
                    ),
                  )
                }
                className="h-9 w-24"
              />
              <div className="flex justify-center">
                <Checkbox
                  checked={row.alertEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, alertEnabled: checked === true } : item)),
                    )
                  }
                />
              </div>
              <Input
                inputMode="decimal"
                value={row.alertAt}
                disabled={lockTracking}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, alertAt: e.target.value.replace(/[^\d.]/g, "") } : item,
                    ),
                  )
                }
                className="h-9 w-24"
              />
            </div>
          ))}
          <p className="mt-2 text-xs text-muted-foreground">{unit}</p>
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <p className="flex-1 text-center text-xs italic text-muted-foreground">
            {t("defaultPrices.product.inventory.hint", "*Use the Inventory page to manage stock")}
          </p>
          <Button
            type="button"
            onClick={() => {
              onConfirm(draft.map((row) => ({ ...row, trackStock: lockTracking ? true : row.trackStock })));
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
