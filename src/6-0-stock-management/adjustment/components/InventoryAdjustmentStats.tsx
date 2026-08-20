import { useTranslation } from "react-i18next";
import type { InventoryAdjustmentStats } from "../types";

export function InventoryAdjustmentStats({ stats }: { stats: InventoryAdjustmentStats }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-12 gap-2">
      <div className="col-span-3 rounded-md border border-gray-100 bg-muted/20 p-3">
        <div className="text-xs text-muted-foreground">{t("operations.inventory.adjustment.adjustments", "ADJUSTMENTS")}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.adjustmentsCount}</div>
      </div>
      <div className="col-span-3 rounded-md border border-gray-100 bg-muted/20 p-3">
        <div className="text-xs text-muted-foreground">{t("operations.inventory.adjustment.itemsAdjusted", "ITEM ADJUSTED")}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.itemsAdjusted}</div>
      </div>
      <div className="col-span-3 rounded-md border border-gray-100 bg-muted/20 p-3">
        <div className="text-xs text-muted-foreground">
          {t("operations.inventory.adjustment.totalExpense", "TOTAL ADJUSTMENT EXPENSE")}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">Rp 0</div>
      </div>
      <div className="col-span-3 rounded-md border border-gray-100 bg-muted/20 p-3">
        <div className="text-xs text-muted-foreground">
          {t("operations.inventory.adjustment.totalIncome", "TOTAL ADJUSTMENT INCOME")}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">Rp 0</div>
      </div>
    </div>
  );
}

