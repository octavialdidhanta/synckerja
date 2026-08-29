import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import {
  discountRowKey,
  parentValueLabel,
  rebuildDiscountDisplayRows,
  sortDiscountSalesDiscounts,
  valueCountByDiscount,
} from "../lib/computeDiscountSalesDisplay";
import type {
  DiscountSalesDisplay,
  DiscountSalesSortDir,
  DiscountSalesSortKey,
} from "../lib/discountSalesTypes";
import { DiscountSalesReconciliationNote } from "./DiscountSalesReconciliationNote";
import { DiscountSalesTableRow } from "./DiscountSalesTableRow";

type Props = {
  display: DiscountSalesDisplay;
  reconciliationDelta: number;
  salesSummaryDiscountTotal: number;
};

function SortIcon({ active, dir }: { active: boolean; dir: DiscountSalesSortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden />
  );
}

function formatCount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatDeduction(amount: number): string {
  return formatReportsMoney(amount, { asDeduction: true });
}

export function DiscountSalesTable({
  display,
  reconciliationDelta,
  salesSummaryDiscountTotal,
}: Props) {
  const { t } = useAppTranslation();
  const [sortKey, setSortKey] = useState<DiscountSalesSortKey>("grossDiscount");
  const [sortDir, setSortDir] = useState<DiscountSalesSortDir>("desc");
  const [collapsedDiscountKeys, setCollapsedDiscountKeys] = useState<Set<string>>(() => new Set());

  const valueCounts = useMemo(() => valueCountByDiscount(display.values), [display.values]);

  const displayRows = useMemo(() => {
    const sortedDiscounts = sortDiscountSalesDiscounts(display.discounts, sortKey, sortDir);
    return rebuildDiscountDisplayRows(sortedDiscounts, display.values);
  }, [display.discounts, display.values, sortKey, sortDir]);

  const visibleRows = useMemo(() => {
    const result: typeof displayRows = [];
    for (const row of displayRows) {
      if (row.rowKind === "discount") {
        result.push(row);
        continue;
      }
      const key = discountRowKey(row.catalogDiscountId, row.discountName);
      if (!collapsedDiscountKeys.has(key)) {
        result.push(row);
      }
    }
    return result;
  }, [displayRows, collapsedDiscountKeys]);

  const toggleDiscountExpanded = (catalogDiscountId: string | null, discountName: string) => {
    const key = discountRowKey(catalogDiscountId, discountName);
    setCollapsedDiscountKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSort = (key: DiscountSalesSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "discountName" ? "asc" : "desc");
  };

  if (display.discounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("reports.discountSales.empty", "No discount usage in this period.")}
      </p>
    );
  }

  const headerBtn = (key: DiscountSalesSortKey, label: string, align: "left" | "right") => (
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
    <div>
      <div className="overflow-hidden rounded-md border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2.5 text-left">
                  {headerBtn(
                    "discountName",
                    t("reports.discountSales.colName", "Name"),
                    "left",
                  )}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-left">
                  {t("reports.discountSales.colDiscountValue", "Discount Value")}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "timesApplied",
                    t("reports.discountSales.colTimesApplied", "Times Applied"),
                    "right",
                  )}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "grossDiscount",
                    t("reports.discountSales.colGrossDiscount", "Gross Discount"),
                    "right",
                  )}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "refundAmount",
                    t("reports.discountSales.colRefund", "Refund"),
                    "right",
                  )}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "netDiscount",
                    t("reports.discountSales.colNetDiscount", "Net Discount"),
                    "right",
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <DiscountSalesTableRow
                  key={
                    row.rowKind === "discount"
                      ? `discount-${row.catalogDiscountId ?? "unknown"}-${row.discountName}`
                      : `value-${row.catalogDiscountId ?? "unknown"}-${row.valueLabel}-${index}`
                  }
                  row={row}
                  parentValueLabel={
                    row.rowKind === "discount"
                      ? parentValueLabel(row, display.values)
                      : undefined
                  }
                  isExpanded={
                    row.rowKind === "discount"
                      ? !collapsedDiscountKeys.has(
                          discountRowKey(row.catalogDiscountId, row.discountName),
                        )
                      : undefined
                  }
                  hasChildren={
                    row.rowKind === "discount"
                      ? (valueCounts.get(discountRowKey(row.catalogDiscountId, row.discountName)) ??
                          0) > 0
                      : undefined
                  }
                  onToggle={
                    row.rowKind === "discount"
                      ? () => toggleDiscountExpanded(row.catalogDiscountId, row.discountName)
                      : undefined
                  }
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td className="px-3 py-3 text-sm">
                  {t("reports.discountSales.grandTotal", "Total")}
                </td>
                <td className="border-l border-border/60 px-3 py-3" />
                <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
                  {formatCount(display.grandTotal.timesApplied)}
                </td>
                <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
                  {formatDeduction(display.grandTotal.grossDiscount)}
                </td>
                <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
                  {formatDeduction(display.grandTotal.refundAmount)}
                </td>
                <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
                  {formatDeduction(display.grandTotal.netDiscount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <DiscountSalesReconciliationNote
        reconciliationDelta={reconciliationDelta}
        salesSummaryDiscountTotal={salesSummaryDiscountTotal}
        reportNetDiscount={display.grandTotal.netDiscount}
      />
    </div>
  );
}
