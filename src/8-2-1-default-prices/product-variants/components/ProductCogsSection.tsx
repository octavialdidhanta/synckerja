import { useState } from "react";
import { Info, Lock } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { CogsRowDraft, VariantDraft } from "../types";
import { ManageProductCogsDialog } from "./ManageProductCogsDialog";

export type ProductCogsSectionProps = {
  productName: string;
  unit: string;
  variants: VariantDraft[];
  inventoryOn: boolean;
  rows: CogsRowDraft[];
  onRowsChange: (rows: CogsRowDraft[]) => void;
  lockCogs: boolean;
};

export function ProductCogsSection({
  productName,
  unit,
  variants,
  inventoryOn,
  rows,
  onRowsChange,
  lockCogs,
}: ProductCogsSectionProps) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const tracking = rows.some((row) => row.trackCogs);
  const summary = rows.reduce((sum, row) => sum + (Number(row.avgCost) || 0), 0);

  return (
    <section className="space-y-3">
      <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("defaultPrices.product.cogs.section", "Cost")}
      </p>
      {inventoryOn && tracking ? (
        <div className="flex items-center justify-between text-sm">
          <span className="truncate">{productName || "—"}</span>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase text-muted-foreground">
              {t("defaultPrices.product.cogs.avgCost", "Avg Cost")}
            </p>
            <p>Rp {summary || "0"}</p>
          </div>
        </div>
      ) : null}
      <Button
        type="button"
        className="w-full"
        disabled={!inventoryOn}
        onClick={() => {
          if (!tracking) onRowsChange(rows.map((row) => ({ ...row, trackCogs: true })));
          setOpen(true);
        }}
      >
        {tracking
          ? t("defaultPrices.product.cogs.manage", "Manage Cost of Goods Sold (COGS)")
          : t("defaultPrices.product.cogs.start", "Start Tracking Cost of Goods Sold (COGS)")}
      </Button>
      <p className="flex gap-2 text-xs text-muted-foreground">
        {inventoryOn ? (
          <>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            {t(
              "defaultPrices.product.cogs.immutable",
              "Avg cost can not be changed after saving the item, so please make sure that it is correct!",
            )}
          </>
        ) : (
          <>
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            {t(
              "defaultPrices.product.cogs.locked",
              "This item can not be tracked because the inventory stock is not tracked.",
            )}
          </>
        )}
      </p>
      <ManageProductCogsDialog
        open={open}
        onOpenChange={setOpen}
        productName={productName}
        unit={unit}
        variants={variants}
        rows={rows}
        lockCogs={lockCogs}
        onConfirm={onRowsChange}
      />
    </section>
  );
}
