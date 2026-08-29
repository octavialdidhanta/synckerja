import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { GrossProfitCategoryFilter } from "../../gross-profit/components/GrossProfitCategoryFilter";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import {
  filterItemSalesBySearch,
  formatItemDisplayName,
  itemSalesRowKey,
  sortItemSalesIncomeRows,
  sumItemSalesRows,
} from "../lib/computeItemSalesDisplay";
import {
  ITEM_SALES_TOP_N,
  type ItemSalesDisplay,
  type ItemSalesIncomeSortKey,
  type ItemSalesSortDir,
} from "../lib/itemSalesTypes";
import { ItemSalesColumnHeader } from "./ItemSalesColumnHeader";
import { ItemSalesReconciliationNote } from "./ItemSalesReconciliationNote";

type Props = {
  display: ItemSalesDisplay;
  search: string;
  onSearchChange: (value: string) => void;
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
};

export function ItemSalesIncomeTable({
  display,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
}: Props) {
  const { t } = useAppTranslation();
  const [sortKey, setSortKey] = useState<ItemSalesIncomeSortKey>("netSales");
  const [sortDir, setSortDir] = useState<ItemSalesSortDir>("desc");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(
    () => filterItemSalesBySearch(display.rows, search),
    [display.rows, search],
  );
  const sorted = useMemo(
    () => sortItemSalesIncomeRows(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  );
  const visible = showAll ? sorted : sorted.slice(0, ITEM_SALES_TOP_N);
  const canToggle = sorted.length > ITEM_SALES_TOP_N;
  const totals = useMemo(
    () => (search.trim() ? sumItemSalesRows(filtered) : display.totals),
    [filtered, display.totals, search],
  );

  const toggleSort = (key: ItemSalesIncomeSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "name" || key === "sku" || key === "category" ? "asc" : "desc");
  };

  const dash = (value: string | null) => value ?? "—";

  if (display.rows.length === 0) {
    return (
      <p className="rounded-md border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        {t("reports.itemSales.empty", "No item sales in this period.")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 items-center justify-end gap-2 overflow-x-auto">
        <GrossProfitCategoryFilter value={categoryId} onChange={onCategoryChange} />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("reports.itemSales.searchPlaceholder", "Search name or SKU…")}
          className="h-9 w-[220px]"
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2.5 text-left">
                  <ItemSalesColumnHeader
                    label={t("reports.itemSales.colName", "Name")}
                    active={sortKey === "name"}
                    dir={sortDir}
                    onClick={() => toggleSort("name")}
                  />
                </th>
                <th className="px-3 py-2.5 text-left">
                  <ItemSalesColumnHeader
                    label={t("reports.itemSales.colSku", "SKU")}
                    active={sortKey === "sku"}
                    dir={sortDir}
                    onClick={() => toggleSort("sku")}
                  />
                </th>
                <th className="px-3 py-2.5 text-left">
                  <ItemSalesColumnHeader
                    label={t("reports.itemSales.colCategory", "Category")}
                    active={sortKey === "category"}
                    dir={sortDir}
                    onClick={() => toggleSort("category")}
                  />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <ItemSalesColumnHeader
                    label={t("reports.itemSales.colGrossSales", "Gross Sales")}
                    align="right"
                    active={sortKey === "grossSales"}
                    dir={sortDir}
                    onClick={() => toggleSort("grossSales")}
                  />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <ItemSalesColumnHeader
                    label={t("reports.itemSales.colNetSales", "Net Sales")}
                    align="right"
                    active={sortKey === "netSales"}
                    dir={sortDir}
                    onClick={() => toggleSort("netSales")}
                  />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <ItemSalesColumnHeader
                    label={t("reports.itemSales.colCogs", "COGS")}
                    align="right"
                    active={sortKey === "cogs"}
                    dir={sortDir}
                    onClick={() => toggleSort("cogs")}
                  />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <ItemSalesColumnHeader
                    label={t("reports.itemSales.colGrossProfit", "Gross Profit")}
                    align="right"
                    active={sortKey === "grossProfit"}
                    dir={sortDir}
                    onClick={() => toggleSort("grossProfit")}
                  />
                </th>
                <th className="px-3 py-2.5 text-right">
                  <ItemSalesColumnHeader
                    label={t("reports.itemSales.colMargin", "Margin %")}
                    align="right"
                    active={sortKey === "marginPct"}
                    dir={sortDir}
                    onClick={() => toggleSort("marginPct")}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    {t("reports.itemSales.noSearchResults", "No items match your search.")}
                  </td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr key={itemSalesRowKey(row)} className="border-b border-border/60">
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {formatItemDisplayName(row)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{dash(row.sku)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{dash(row.categoryName)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatReportsMoney(row.grossSales)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatReportsMoney(row.netSales)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatReportsMoney(row.cogs)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatReportsMoney(row.grossProfit)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.marginPct}%</td>
                  </tr>
                ))
              )}
              {visible.length > 0 ? (
                <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                  <td className="px-3 py-3" colSpan={3}>
                    {t("reports.itemSales.grandTotal", "Grand Total")}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatReportsMoney(totals.grossSales)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatReportsMoney(totals.netSales)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatReportsMoney(totals.cogs)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatReportsMoney(totals.grossProfit)}
                  </td>
                  <td className="px-3 py-3" />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ItemSalesReconciliationNote display={display} variant="income" />
      </div>

      {canToggle ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll
              ? t("reports.itemSales.showTop", "Show top {n}", { n: ITEM_SALES_TOP_N })
              : t("reports.itemSales.showAll", "Show all ({n})", { n: sorted.length })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
