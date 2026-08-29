import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import {
  brandRowKey,
  rebuildDisplayRows,
  sortBrandSalesBrands,
} from "../lib/computeBrandSalesDisplay";
import type {
  BrandSalesDisplay,
  BrandSalesSortDir,
  BrandSalesSortKey,
} from "../lib/brandSalesTypes";
import { BrandSalesReconciliationNote } from "./BrandSalesReconciliationNote";
import { BrandSalesTableRow } from "./BrandSalesTableRow";

type Props = {
  display: BrandSalesDisplay;
};

function SortIcon({ active, dir }: { active: boolean; dir: BrandSalesSortDir }) {
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

export function BrandSalesTable({ display }: Props) {
  const { t } = useAppTranslation();
  const [sortKey, setSortKey] = useState<BrandSalesSortKey>("grossSales");
  const [sortDir, setSortDir] = useState<BrandSalesSortDir>("desc");
  const [collapsedBrandKeys, setCollapsedBrandKeys] = useState<Set<string>>(() => new Set());

  const itemCountByBrand = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of display.items) {
      const key = brandRowKey(item.brandId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [display.items]);

  const displayRows = useMemo(() => {
    const sortedBrands = sortBrandSalesBrands(display.brands, sortKey, sortDir);
    return rebuildDisplayRows(sortedBrands, display.items);
  }, [display.brands, display.items, sortKey, sortDir]);

  const visibleRows = useMemo(() => {
    const result: typeof displayRows = [];
    for (const row of displayRows) {
      if (row.rowKind === "brand") {
        result.push(row);
        continue;
      }
      if (!collapsedBrandKeys.has(brandRowKey(row.brandId))) {
        result.push(row);
      }
    }
    return result;
  }, [displayRows, collapsedBrandKeys]);

  const toggleBrandExpanded = (brandId: string | null) => {
    const key = brandRowKey(brandId);
    setCollapsedBrandKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSort = (key: BrandSalesSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "brandName" ? "asc" : "desc");
  };

  if (display.brands.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("reports.brandSales.empty", "No brand sales in this period.")}
      </p>
    );
  }

  const headerBtn = (key: BrandSalesSortKey, label: string, align: "left" | "right") => (
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
                {headerBtn("brandName", t("reports.brandSales.colBrand", "Brand"), "left")}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "qtySold",
                  t("reports.brandSales.colItemsSold", "Items Sold"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "qtyRefunded",
                  t("reports.brandSales.colItemsRefunded", "Items Refunded"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "grossSales",
                  t("reports.brandSales.colGrossSales", "Gross Sales"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "discountAmount",
                  t("reports.brandSales.colDiscount", "Discount"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "refundAmount",
                  t("reports.brandSales.colRefunds", "Refunds"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "netSales",
                  t("reports.brandSales.colNetSales", "Net Sales"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "grossProfit",
                  t("reports.brandSales.colGrossProfit", "Gross Profit"),
                  "right",
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <BrandSalesTableRow
                key={
                  row.rowKind === "brand"
                    ? `brand-${row.brandId ?? "unbranded"}`
                    : `item-${row.brandId ?? "unbranded"}-${row.catalogProductId ?? "x"}-${row.catalogVariantId ?? "x"}-${row.catalogBundleId ?? "x"}-${index}`
                }
                row={row}
                isExpanded={
                  row.rowKind === "brand"
                    ? !collapsedBrandKeys.has(brandRowKey(row.brandId))
                    : undefined
                }
                hasChildren={
                  row.rowKind === "brand"
                    ? (itemCountByBrand.get(brandRowKey(row.brandId)) ?? 0) > 0
                    : undefined
                }
                onToggle={
                  row.rowKind === "brand"
                    ? () => toggleBrandExpanded(row.brandId)
                    : undefined
                }
              />
            ))}
            <tr className="border-t-2 border-border bg-muted/30 font-semibold">
              <td className="px-3 py-3 text-sm">
                {t("reports.brandSales.grandTotal", "Grand Total")}
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
      <BrandSalesReconciliationNote display={display} />
    </div>
  );
}
