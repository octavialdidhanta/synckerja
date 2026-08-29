import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { filterGrossProfitItemsBySearch } from "../lib/computeGrossProfitItemsDisplay";
import { formatGrossProfitMoney } from "../lib/computeGrossProfitDisplay";
import { buildGrossProfitItemsFooterState } from "../lib/computeGrossProfitItemsTotals";
import {
  GROSS_PROFIT_ITEMS_TOP_N,
  type GrossProfitItemRow,
} from "../lib/grossProfitItemTypes";
import type { GrossProfitMetrics } from "../lib/grossProfitTypes";
import type { GrossProfitNonProductRow } from "../lib/grossProfitNonProductTypes";
import { GrossProfitCategoryFilter } from "./GrossProfitCategoryFilter";
import { GrossProfitItemsFooter, GrossProfitItemsReconciliationNote } from "./GrossProfitItemsFooter";

type Props = {
  items: GrossProfitItemRow[];
  nonProductRows: GrossProfitNonProductRow[];
  nonProductLoading?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  metrics: Pick<GrossProfitMetrics, "netSales" | "productNetSales" | "nonProductNet">;
};

export function GrossProfitItemsTable({
  items,
  nonProductRows,
  nonProductLoading,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  metrics,
}: Props) {
  const { t } = useAppTranslation();
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(
    () => filterGrossProfitItemsBySearch(items, search),
    [items, search],
  );
  const visible = showAll ? filtered : filtered.slice(0, GROSS_PROFIT_ITEMS_TOP_N);
  const canToggle = filtered.length > GROSS_PROFIT_ITEMS_TOP_N;
  const footer = useMemo(
    () => buildGrossProfitItemsFooterState({ items: filtered, metrics }),
    [filtered, metrics],
  );

  const showTable = filtered.length > 0 || metrics.nonProductNet > 0.01;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-3 overflow-x-auto">
        <h3 className="shrink-0 text-sm font-semibold text-foreground">
          {t("reports.grossProfit.items.title", "Profit by item")}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <GrossProfitCategoryFilter value={categoryId} onChange={onCategoryChange} />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t(
              "reports.grossProfit.items.searchPlaceholder",
              "Search product or variant…",
            )}
            className="h-9 w-[220px]"
          />
        </div>
      </div>

      {!showTable ? (
        <p className="rounded-md border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {t("reports.grossProfit.items.empty", "No product sales in this period.")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">
                  {t("reports.grossProfit.items.colProduct", "Product")}
                </th>
                <th className="px-3 py-2">
                  {t("reports.grossProfit.items.colVariant", "Variant")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("reports.grossProfit.items.colQty", "Qty")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("reports.grossProfit.items.colNetSales", "Net Sales")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("reports.grossProfit.items.colCogs", "COGS")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("reports.grossProfit.items.colProfit", "Gross Profit")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("reports.grossProfit.items.colMargin", "Margin %")}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const key = `${row.catalogProductId ?? "none"}:${row.catalogVariantId ?? "none"}:${row.productName}`;
                const unlinked = !row.catalogProductId;
                return (
                  <tr key={key} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-foreground">
                          {unlinked
                            ? t("reports.grossProfit.items.unlinked", "Unlinked")
                            : row.productName}
                        </span>
                        {row.cogsIncomplete ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                            {t("reports.grossProfit.items.incomplete", "Incomplete")}
                          </span>
                        ) : null}
                        {row.cogsEstimated && !row.cogsIncomplete ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                            {t("reports.grossProfit.items.estimated", "Estimated")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {row.variantName || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.qty}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatGrossProfitMoney(row.netSales)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums",
                        row.cogs > 0 && "text-muted-foreground",
                      )}
                    >
                      {formatGrossProfitMoney(row.cogs, { asDeduction: true })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {formatGrossProfitMoney(row.grossProfit)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.marginPct}%</td>
                  </tr>
                );
              })}
            </tbody>
            <GrossProfitItemsFooter
              footer={footer}
              nonProductRows={nonProductRows}
              nonProductLoading={nonProductLoading}
            />
          </table>
          </div>
          <GrossProfitItemsReconciliationNote footer={footer} />
        </div>
      )}

      {canToggle ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? t("reports.grossProfit.items.showTop50", "Show top 50")
              : t("reports.grossProfit.items.showAll", "Show all")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
