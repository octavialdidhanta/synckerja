import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { GrossProfitCategoryFilter } from "../../gross-profit/components/GrossProfitCategoryFilter";
import {
  filterItemSalesBySearch,
  formatItemDisplayName,
  itemSalesRowKey,
  resolveQtyAlaCarte,
  resolveQtyBundle,
  sortItemSalesQuantityRows,
  sumItemSalesRows,
} from "../lib/computeItemSalesDisplay";
import {
  ITEM_SALES_TOP_N,
  type ItemSalesDisplay,
  type ItemSalesQuantitySortKey,
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

export function ItemSalesQuantityTable({
  display,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
}: Props) {
  const { t } = useAppTranslation();
  const [sortKey, setSortKey] = useState<ItemSalesQuantitySortKey>("qtyAlaCarte");
  const [sortDir, setSortDir] = useState<ItemSalesSortDir>("desc");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(
    () => filterItemSalesBySearch(display.rows, search),
    [display.rows, search],
  );
  const sorted = useMemo(
    () => sortItemSalesQuantityRows(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  );
  const visible = showAll ? sorted : sorted.slice(0, ITEM_SALES_TOP_N);
  const canToggle = sorted.length > ITEM_SALES_TOP_N;
  const totals = useMemo(
    () => (search.trim() ? sumItemSalesRows(filtered) : display.totals),
    [filtered, display.totals, search],
  );

  const toggleSort = (key: ItemSalesQuantitySortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "name" || key === "sku" || key === "category" ? "asc" : "desc");
  };

  const dash = (value: string | null) => value ?? "—";

  const quantitySoldTooltip = t(
    "reports.itemSales.tooltipQuantitySold",
    "Units sold from non-refunded checkouts in the selected sale period, split by a la carte product lines vs bundle packages.",
  );

  if (display.rows.length === 0) {
    return (
      <p className="rounded-md border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        {t("reports.itemSales.empty", "No item sales in this period.")}
      </p>
    );
  }

  const headerBtn = (
    key: ItemSalesQuantitySortKey,
    label: string,
    align: "left" | "right" | "center",
  ) => (
    <ItemSalesColumnHeader
      label={label}
      align={align === "center" ? "right" : align}
      active={sortKey === key}
      dir={sortDir}
      onClick={() => toggleSort(key)}
    />
  );

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
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left" rowSpan={2}>
                  {headerBtn("name", t("reports.itemSales.colName", "Name"), "left")}
                </th>
                <th className="px-3 py-2 text-left" rowSpan={2}>
                  {headerBtn("sku", t("reports.itemSales.colSku", "SKU"), "left")}
                </th>
                <th className="px-3 py-2 text-left" rowSpan={2}>
                  {headerBtn("category", t("reports.itemSales.colCategory", "Category"), "left")}
                </th>
                <th className="border-l border-border px-3 py-2 text-center" colSpan={2}>
                  <ItemSalesColumnHeader
                    label={t("reports.itemSales.colQuantitySold", "Quantity Sold")}
                    tooltip={quantitySoldTooltip}
                    align="center"
                    sortable={false}
                  />
                </th>
              </tr>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="border-l border-border px-3 py-2 text-right">
                  {headerBtn(
                    "qtyAlaCarte",
                    t("reports.itemSales.colAlaCarte", "A la Carte"),
                    "right",
                  )}
                </th>
                <th className="px-3 py-2 text-right">
                  {headerBtn("qtyBundle", t("reports.itemSales.colBundle", "Bundle"), "right")}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
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
                    <td className="border-l border-border/60 px-3 py-2.5 text-right tabular-nums">
                      {resolveQtyAlaCarte(row)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {resolveQtyBundle(row)}
                    </td>
                  </tr>
                ))
              )}
              {visible.length > 0 ? (
                <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                  <td className="px-3 py-3" colSpan={3}>
                    {t("reports.itemSales.grandTotal", "Grand Total")}
                  </td>
                  <td className="border-l border-border/60 px-3 py-3 text-right tabular-nums">
                    {totals.qtyAlaCarte}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.qtyBundle}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ItemSalesReconciliationNote display={display} variant="quantity" />
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
