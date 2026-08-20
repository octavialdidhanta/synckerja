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
import { formatIngredientUnitCode } from "../lib/ingredientUnits";

export type InventoryDraft = {
  trackStock: boolean;
  inStock: string;
  alertEnabled: boolean;
  alertAt: string;
};

export type ManageIngredientInventoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  unitCode: string;
  value: InventoryDraft;
  lockTracking: boolean;
  onConfirm: (next: InventoryDraft) => void;
};

export function ManageIngredientInventoryDialog({
  open,
  onOpenChange,
  name,
  unitCode,
  value,
  lockTracking,
  onConfirm,
}: ManageIngredientInventoryDialogProps) {
  const { t } = useAppTranslation();
  const [draft, setDraft] = useState<InventoryDraft>(value);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
  }, [open, value]);

  const handleConfirm = () => {
    onConfirm({
      ...draft,
      trackStock: lockTracking ? true : draft.trackStock,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("ingredient.library.inventoryTitle", "Manage Ingredient Inventory")}
          </DialogTitle>
        </div>
        <div className="px-4 py-3">
          <div className="grid grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto_minmax(7rem,1fr)] items-end gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{t("ingredient.library.ingredientLabel", "Ingredient")}</span>
            <span className="text-center">{t("ingredient.library.trackStock", "Track Stock")}</span>
            <span>{t("ingredient.library.inStock", "In Stock")}</span>
            <span className="text-center">{t("ingredient.library.alert", "Alert")}</span>
            <span>{t("ingredient.library.alertAt", "Alert at")}</span>
            <span>{t("ingredient.library.columnUnit", "Unit")}</span>
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto_minmax(7rem,1fr)] items-center gap-3">
            <span className="truncate text-sm">{name || "—"}</span>
            <div className="flex justify-center">
              <Checkbox
                checked={lockTracking || draft.trackStock}
                disabled={lockTracking}
                onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, trackStock: checked === true }))}
              />
            </div>
            <Input
              inputMode="decimal"
              value={draft.inStock}
              onChange={(e) => setDraft((prev) => ({ ...prev, inStock: e.target.value.replace(/[^\d.]/g, "") }))}
              className="h-9 w-24"
            />
            <div className="flex justify-center">
              <Checkbox
                checked={draft.alertEnabled}
                onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, alertEnabled: checked === true }))}
              />
            </div>
            <Input
              inputMode="decimal"
              value={draft.alertAt}
              onChange={(e) => setDraft((prev) => ({ ...prev, alertAt: e.target.value.replace(/[^\d.]/g, "") }))}
              className="h-9 w-24"
            />
            <span className="truncate text-sm text-muted-foreground">{formatIngredientUnitCode(unitCode)}</span>
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <p className="flex-1 text-center text-xs italic text-muted-foreground">
            {t("ingredient.library.inventoryHint", "*Use the Inventory page to manage stock")}
          </p>
          <Button type="button" onClick={handleConfirm}>
            {t("ingredient.library.confirm", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
