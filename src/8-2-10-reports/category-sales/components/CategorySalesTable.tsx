import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { sortCategorySalesRows } from "../lib/computeCategorySalesDisplay";
import type {
  CategorySalesDisplay,
  CategorySalesSortDir,
  CategorySalesSortKey,
} from "../lib/categorySalesTypes";
import { CategorySalesReconciliationNote } from "./CategorySalesReconciliationNote";

type Props = {
  display: CategorySalesDisplay;
};

function SortIcon({ active, dir }: { active: boolean; dir: CategorySalesSortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden />
  );
}

function formatQty(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatDeduction(amount: number): string {
  return formatReportsMoney(amount, { asDeduction: true });
}

export function CategorySalesTable({ display }: Props) {
  const { t } = useAppTranslation();
  const [sortKey, setSortKey] = useState<CategorySalesSortKey>("grossSales");
  const [sortDir, setSortDir] = useState<CategorySalesSortDir>("desc");

  const sortedRows = useMemo(
    () => sortCategorySalesRows(display.rows, sortKey, sortDir),
    [display.rows, sortKey, sortDir],
  );

  const toggleSort = (key: CategorySalesSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "categoryName" ? "asc" : "desc");
  };

  if (display.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("reports.categorySales.empty", "No category sales in this period.")}
      </p>
    );
  }

  const headerBtn = (key: CategorySalesSortKey, label: string, align: "left" | "right") => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className={cn(
        "inline-flex w-full items-center font-medium uppercase tracking-wide",
        align === "right" && "justify-end",
      )}
    >
      {label}
      <SortIcon active={sortKey === key} dir={sortDir} />
    </button>
  );

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2.5 text-left">
                {headerBtn(
                  "categoryName",
                  t("reports.categorySales.colCategory", "Category"),
                  "left",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "qtySold",
                  t("reports.categorySales.colItemsSold", "Items Sold"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "qtyRefunded",
                  t("reports.categorySales.colItemsRefunded", "Items Refunded"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "grossSales",
                  t("reports.categorySales.colGrossSales", "Gross Sales"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "discountAmount",
                  t("reports.categorySales.colDiscount", "Discount"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "refundAmount",
                  t("reports.categorySales.colRefunds", "Refunds"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "netSales",
                  t("reports.categorySales.colNetSales", "Net Sales"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "grossProfit",
                  t("reports.categorySales.colGrossProfit", "Gross Profit"),
                  "right",
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.categoryId ?? "__uncategorized__"}
                className="border-b border-border/60 hover:bg-muted/20"
              >
                <td className="px-3 py-3 text-sm">{row.categoryName}</td>
                <td className="px-3 py-3 text-right text-sm tabular-nums">
                  {formatQty(row.qtySold)}
                </td>
                <td className="px-3 py-3 text-right text-sm tabular-nums">
                  {formatQty(row.qtyRefunded)}
                </td>
                <td className="px-3 py-3 text-right text-sm tabular-nums">
                  {formatReportsMoney(row.grossSales)}
                </td>
                <td className="px-3 py-3 text-right text-sm tabular-nums">
                  {formatDeduction(row.discountAmount)}
                </td>
                <td className="px-3 py-3 text-right text-sm tabular-nums">
                  {formatDeduction(row.refundAmount)}
                </td>
                <td className="px-3 py-3 text-right text-sm tabular-nums">
                  {formatReportsMoney(row.netSales)}
                </td>
                <td className="px-3 py-3 text-right text-sm tabular-nums">
                  {formatReportsMoney(row.grossProfit)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/30 font-semibold">
              <td className="px-3 py-3 text-sm">
                {t("reports.categorySales.grandTotal", "Grand Total")}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">
                {formatQty(display.grandTotal.qtySold)}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">
                {formatQty(display.grandTotal.qtyRefunded)}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">
                {formatReportsMoney(display.grandTotal.grossSales)}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">
                {formatDeduction(display.grandTotal.discountAmount)}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">
                {formatDeduction(display.grandTotal.refundAmount)}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">
                {formatReportsMoney(display.grandTotal.netSales)}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">
                {formatReportsMoney(display.grandTotal.grossProfit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <CategorySalesReconciliationNote display={display} />
    </div>
  );
}
