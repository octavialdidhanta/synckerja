import { useEffect, useState, type ReactNode } from "react";
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
import { cn } from "@/shared/lib/utils";
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

function InventoryColumn({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-2", className)}>
      <span className="w-full text-center text-[11px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex h-9 w-full items-center justify-center">{children}</div>
    </div>
  );
}

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
        <div className="px-4 py-4">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(4.5rem,1fr))_minmax(5.5rem,1fr)]">
            <InventoryColumn
              label={t("ingredient.library.ingredientLabel", "Ingredient")}
              className="col-span-2 items-start sm:col-span-1"
            >
              <span className="w-full truncate text-left text-sm font-medium text-foreground">
                {name || "—"}
              </span>
            </InventoryColumn>

            <InventoryColumn label={t("ingredient.library.trackStock", "Track Stock")}>
              <Checkbox
                checked={lockTracking || draft.trackStock}
                disabled={lockTracking}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, trackStock: checked === true }))
                }
              />
            </InventoryColumn>

            <InventoryColumn label={t("ingredient.library.inStock", "In Stock")}>
              <Input
                inputMode="decimal"
                value={draft.inStock}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    inStock: e.target.value.replace(/[^\d.]/g, ""),
                  }))
                }
                className="h-9 w-full min-w-0 text-center"
              />
            </InventoryColumn>

            <InventoryColumn label={t("ingredient.library.alert", "Alert")}>
              <Checkbox
                checked={draft.alertEnabled}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, alertEnabled: checked === true }))
                }
              />
            </InventoryColumn>

            <InventoryColumn label={t("ingredient.library.alertAt", "Alert at")}>
              <Input
                inputMode="decimal"
                value={draft.alertAt}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    alertAt: e.target.value.replace(/[^\d.]/g, ""),
                  }))
                }
                className="h-9 w-full min-w-0 text-center"
              />
            </InventoryColumn>

            <InventoryColumn label={t("ingredient.library.columnUnit", "Unit")}>
              <span className="truncate text-center text-sm text-muted-foreground">
                {formatIngredientUnitCode(unitCode)}
              </span>
            </InventoryColumn>
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
