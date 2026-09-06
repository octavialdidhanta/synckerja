import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
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

export function PosInventoryTable({
  outletId,
  rows,
  isLoading,
  isError,
  onRetry,
}: Props) {
  const { t } = useAppTranslation();

  const alertLabel = (row: CatalogIngredient) => {
    const status = ingredientStockStatus(row, outletId);
    if (status === "low") return t("ingredient.library.statusLow", "Low Stock");
    if (status === "out") return t("ingredient.library.statusOut", "Out of Stock");
    return "";
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-200 hover:bg-transparent">
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(POS_INVENTORY_I18N.columnName, "Ingredient Name")}
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(POS_INVENTORY_I18N.columnStock, "Stock Qty")}
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(POS_INVENTORY_I18N.columnUnit, "Unit")}
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(POS_INVENTORY_I18N.columnAlert, "Stock Warning")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="border-slate-200">
              <TableCell colSpan={4} className="h-24 text-center text-sm text-slate-400">
                …
              </TableCell>
            </TableRow>
          ) : isError ? (
            <TableRow className="border-slate-200">
              <TableCell colSpan={4} className="h-24 text-center">
                <p className="mb-2 text-sm text-destructive">
                  {t(POS_INVENTORY_I18N.loadError, "Failed to load inventory.")}
                </p>
                {onRetry ? (
                  <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                    {t(POS_INVENTORY_I18N.retry, "Retry")}
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow className="border-slate-200">
              <TableCell colSpan={4} className="h-24 text-center text-sm text-slate-400">
                {t(POS_INVENTORY_I18N.empty, "No ingredients found.")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const stock = stockForOutlet(row, outletId);
              const status = ingredientStockStatus(row, outletId);
              const warning = alertLabel(row);
              return (
                <TableRow key={row.id} className="border-slate-200 hover:bg-slate-50/80">
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <PosInventoryRowAvatar name={row.name} />
                      <span className="truncate text-sm font-medium text-slate-900">
                        {row.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-slate-800">
                    {formatIngredientStockQty(stock.in_stock)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {formatIngredientUnitCode(row.unit_code)}
                  </TableCell>
                  <TableCell>
                    {warning ? (
                      <span
                        className={cn(
                          "text-sm font-medium",
                          status === "out" ? "text-rose-600" : "text-amber-600",
                        )}
                      >
                        {warning}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
