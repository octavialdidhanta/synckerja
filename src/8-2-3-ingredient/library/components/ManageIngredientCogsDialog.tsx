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

export type CogsDraft = {
  trackCogs: boolean;
  avgCost: string;
};

export type ManageIngredientCogsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  unitCode: string;
  value: CogsDraft;
  onConfirm: (next: CogsDraft) => void;
};

export function ManageIngredientCogsDialog({
  open,
  onOpenChange,
  name,
  unitCode,
  value,
  onConfirm,
}: ManageIngredientCogsDialogProps) {
  const { t } = useAppTranslation();
  const [draft, setDraft] = useState<CogsDraft>(value);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
  }, [open, value]);

  const handleConfirm = () => {
    onConfirm(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("ingredient.library.cogsTitle", "Manage Cost of Goods Sold (COGS)")}
          </DialogTitle>
        </div>
        <div className="px-4 py-3">
          <div className="grid grid-cols-[minmax(0,1.2fr)_auto_minmax(8rem,1fr)_minmax(7rem,1fr)] items-end gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{t("ingredient.library.ingredientLabel", "Ingredient")}</span>
            <span className="text-center">{t("ingredient.library.trackCogs", "Track COGS")}</span>
            <span>{t("ingredient.library.avgCost", "Avg Cost")}</span>
            <span>{t("ingredient.library.columnUnit", "Unit")}</span>
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,1.2fr)_auto_minmax(8rem,1fr)_minmax(7rem,1fr)] items-center gap-3">
            <span className="truncate text-sm">{name || "—"}</span>
            <div className="flex justify-center">
              <Checkbox
                checked={draft.trackCogs}
                onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, trackCogs: checked === true }))}
              />
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                inputMode="numeric"
                value={draft.avgCost}
                onChange={(e) => setDraft((prev) => ({ ...prev, avgCost: e.target.value.replace(/[^\d]/g, "") }))}
                className="h-9 pl-8"
              />
            </div>
            <span className="truncate text-sm text-muted-foreground">
              {t("ingredient.library.perUnit", "Per {{unit}}", { unit: formatIngredientUnitCode(unitCode) })}
            </span>
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <p className="flex-1 text-center text-xs italic text-muted-foreground">
            {t("ingredient.library.cogsHint", "*Use the Purchase Order Page to manage Avg Cost")}
          </p>
          <Button type="button" onClick={handleConfirm}>
            {t("ingredient.library.confirm", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
