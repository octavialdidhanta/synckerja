import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  formatIngredientStockQty,
  ingredientStockStatus,
} from "@/8-2-3-ingredient/library/lib/ingredientStockStatus";
import { formatIngredientUnitCode } from "@/8-2-3-ingredient/library/lib/ingredientUnits";
import {
  stockForOutlet,
  type CatalogIngredient,
} from "@/8-2-3-ingredient/library/types";
import { cn } from "@/shared/lib/utils";
import { POS_INVENTORY_I18N } from "../lib/posInventoryCopy";
import { PosInventoryRowAvatar } from "./PosInventoryRowAvatar";

type Props = {
  outletId: string;
  rows: CatalogIngredient[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
};

/** Phone list — stacked rows instead of a cramped multi-column table. */
export function PosInventoryPhoneList({
  outletId,
  rows,
  isLoading,
  isError,
  onRetry,
}: Props) {
  const { t } = useAppTranslation();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16 text-sm text-slate-400">
        …
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16">
        <p className="text-center text-sm text-destructive">
          {t(POS_INVENTORY_I18N.loadError, "Failed to load inventory.")}
        </p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t(POS_INVENTORY_I18N.retry, "Retry")}
          </Button>
        ) : null}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16 text-center text-sm text-slate-400">
        {t(POS_INVENTORY_I18N.empty, "No ingredients found.")}
      </div>
    );
  }

  return (
    <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="divide-y divide-slate-200">
        {rows.map((row) => {
          const stock = stockForOutlet(row, outletId);
          const status = ingredientStockStatus(row, outletId);
          const qty = formatIngredientStockQty(stock.in_stock);
          const unit = formatIngredientUnitCode(row.unit_code);
          const warning =
            status === "low"
              ? t(POS_INVENTORY_I18N.phoneFilterLow, "Low")
              : status === "out"
                ? t(POS_INVENTORY_I18N.phoneFilterOut, "Out")
                : null;

          return (
            <li key={row.id} className="flex items-center gap-3 px-3 py-3">
              <PosInventoryRowAvatar name={row.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  <span className="tabular-nums text-slate-700">{qty}</span>
                  <span className="text-slate-400"> · </span>
                  <span>{unit}</span>
                </p>
              </div>
              {warning ? (
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                    status === "out"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-amber-50 text-amber-700",
                  )}
                >
                  {warning}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
