import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { FieldInfoTip } from "../../components/FieldInfoTip";
import type { InventoryRowDraft, VariantDraft } from "../types";
import { ManageProductInventoryDialog } from "./ManageProductInventoryDialog";
import { useState } from "react";
import {
  canStartItemInventoryTracking,
} from "../../lib/displayRecipePosStatus";

export type ProductInventorySectionProps = {
  productName: string;
  unit: string;
  variants: VariantDraft[];
  rows: InventoryRowDraft[];
  onRowsChange: (rows: InventoryRowDraft[]) => void;
  lockTracking: boolean;
  hasBaseRecipe?: boolean;
  hideHeading?: boolean;
};

export function ProductInventorySection({
  productName,
  unit,
  variants,
  rows,
  onRowsChange,
  lockTracking,
  hasBaseRecipe = false,
  hideHeading,
}: ProductInventorySectionProps) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const tracking = lockTracking || rows.some((row) => row.trackStock);
  const canStartTracking = canStartItemInventoryTracking(hasBaseRecipe);
  const recipeLocksStart = hasBaseRecipe && !tracking;
  const summaryQty = rows.reduce((sum, row) => sum + (Number(row.inStock) || 0), 0);

  return (
    <section className="space-y-3">
      {hideHeading ? null : (
        <div className="flex items-center gap-1.5 border-b pb-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("defaultPrices.product.inventory.section", "Inventory")}
          </p>
          <FieldInfoTip
            text={
              hasBaseRecipe
                ? t(
                    "defaultPrices.product.inventory.recipeLocksTracking",
                    "Living stock comes from the ingredient recipe. Do not track finished-goods item stock for this menu.",
                  )
                : t(
                    "defaultPrices.product.inventory.immutable",
                    "Item stock can not be changed after saving the item, so please make sure that it is correct!",
                  )
            }
          />
        </div>
      )}
      {tracking ? (
        <div className="flex items-center justify-between text-sm">
          <span className="truncate">{productName || "—"}</span>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase text-muted-foreground">
              {t("defaultPrices.product.inventory.inStock", "In Stock")}
            </p>
            <p>{summaryQty}</p>
          </div>
        </div>
      ) : null}
      <Button
        type="button"
        className="w-full"
        disabled={recipeLocksStart}
        onClick={() => {
          if (recipeLocksStart) return;
          if (!tracking) {
            if (!canStartTracking) return;
            onRowsChange(rows.map((row) => ({ ...row, trackStock: true })));
          }
          setOpen(true);
        }}
      >
        {tracking
          ? t("defaultPrices.product.inventory.manage", "Manage Item Inventory and Alerts")
          : t("defaultPrices.product.inventory.start", "Start Tracking Item Inventory and Alerts")}
      </Button>
      <ManageProductInventoryDialog
        open={open}
        onOpenChange={setOpen}
        productName={productName}
        unit={unit}
        variants={variants}
        rows={rows}
        lockTracking={lockTracking}
        hasBaseRecipe={hasBaseRecipe}
        onConfirm={onRowsChange}
      />
    </section>
  );
}
