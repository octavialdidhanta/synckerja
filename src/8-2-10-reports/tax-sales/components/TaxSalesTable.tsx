import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import {
  parentRateLabel,
  rateCountByTax,
  rebuildTaxDisplayRows,
  sortTaxSalesTaxes,
  taxRowKey,
} from "../lib/computeTaxSalesDisplay";
import type {
  TaxSalesDisplay,
  TaxSalesSortDir,
  TaxSalesSortKey,
} from "../lib/taxSalesTypes";
import { TaxSalesReconciliationNote } from "./TaxSalesReconciliationNote";
import { TaxSalesTableRow } from "./TaxSalesTableRow";

type Props = {
  display: TaxSalesDisplay;
  reconciliationDelta: number;
  salesSummaryTaxTotal: number;
  reportNetTaxCollected: number;
};

function SortIcon({ active, dir }: { active: boolean; dir: TaxSalesSortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden />
  );
}

export function TaxSalesTable({
  display,
  reconciliationDelta,
  salesSummaryTaxTotal,
  reportNetTaxCollected,
}: Props) {
  const { t } = useAppTranslation();
  const [sortKey, setSortKey] = useState<TaxSalesSortKey>("taxCollected");
  const [sortDir, setSortDir] = useState<TaxSalesSortDir>("desc");
  const [collapsedTaxKeys, setCollapsedTaxKeys] = useState<Set<string>>(() => new Set());

  const rateCounts = useMemo(() => rateCountByTax(display.rates), [display.rates]);

  const displayRows = useMemo(() => {
    const sortedTaxes = sortTaxSalesTaxes(display.taxes, sortKey, sortDir);
    return rebuildTaxDisplayRows(sortedTaxes, display.rates);
  }, [display.taxes, display.rates, sortKey, sortDir]);

  const visibleRows = useMemo(() => {
    const result: typeof displayRows = [];
    for (const row of displayRows) {
      if (row.rowKind === "tax") {
        result.push(row);
        continue;
      }
      const key = taxRowKey(row.catalogTaxId, row.taxName);
      if (!collapsedTaxKeys.has(key)) {
        result.push(row);
      }
    }
    return result;
  }, [displayRows, collapsedTaxKeys]);

  const toggleTaxExpanded = (catalogTaxId: string | null, taxName: string) => {
    const key = taxRowKey(catalogTaxId, taxName);
    setCollapsedTaxKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSort = (key: TaxSalesSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "taxName" ? "asc" : "desc");
  };

  if (display.taxes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("reports.taxSales.empty", "No tax collected in this period.")}
      </p>
    );
  }

  const headerBtn = (key: TaxSalesSortKey, label: string, align: "left" | "right") => (
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
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2.5 text-left">
                  {headerBtn("taxName", t("reports.taxSales.colTaxName", "Name"), "left")}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-left">
                  {t("reports.taxSales.colTaxRate", "Tax Rate")}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "taxableAmount",
                    t("reports.taxSales.colTaxableAmount", "Taxable Amount"),
                    "right",
                  )}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "taxCollected",
                    t("reports.taxSales.colTaxCollected", "Tax Collected"),
                    "right",
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <TaxSalesTableRow
                  key={
                    row.rowKind === "tax"
                      ? `tax-${row.catalogTaxId ?? "unknown"}-${row.taxName}`
                      : `rate-${row.catalogTaxId ?? "unknown"}-${row.rateLabel}-${index}`
                  }
                  row={row}
                  parentRateLabel={
                    row.rowKind === "tax" ? parentRateLabel(row, display.rates) : undefined
                  }
                  isExpanded={
                    row.rowKind === "tax"
                      ? !collapsedTaxKeys.has(taxRowKey(row.catalogTaxId, row.taxName))
                      : undefined
                  }
                  hasChildren={
                    row.rowKind === "tax"
                      ? (rateCounts.get(taxRowKey(row.catalogTaxId, row.taxName)) ?? 0) > 0
                      : undefined
                  }
                  onToggle={
                    row.rowKind === "tax"
                      ? () => toggleTaxExpanded(row.catalogTaxId, row.taxName)
                      : undefined
                  }
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td className="px-3 py-3 text-sm">
                  {t("reports.taxSales.totalTaxCollected", "Total Tax Collected")}
                </td>
                <td className="border-l border-border/60 px-3 py-3" />
                <td className="border-l border-border/60 px-3 py-3" />
                <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
                  {formatReportsMoney(display.grandTotal.taxCollected)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <TaxSalesReconciliationNote
        reconciliationDelta={reconciliationDelta}
        salesSummaryTaxTotal={salesSummaryTaxTotal}
        reportNetTaxCollected={reportNetTaxCollected}
        hasBackfillEstimate={display.hasBackfillEstimate}
      />
    </div>
  );
}
