import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import {
  gratuityRowKey,
  parentRateLabel,
  rateCountByGratuity,
  rebuildGratuityDisplayRows,
  sortGratuitySalesGratuities,
} from "../lib/computeGratuitySalesDisplay";
import type {
  GratuitySalesDisplay,
  GratuitySalesSortDir,
  GratuitySalesSortKey,
} from "../lib/gratuitySalesTypes";
import { GratuitySalesReconciliationNote } from "./GratuitySalesReconciliationNote";
import { GratuitySalesTableRow } from "./GratuitySalesTableRow";

type Props = {
  display: GratuitySalesDisplay;
  reconciliationDelta: number;
  salesSummaryGratuityTotal: number;
  reportNetGratuityCollected: number;
};

function SortIcon({ active, dir }: { active: boolean; dir: GratuitySalesSortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden />
  );
}

export function GratuitySalesTable({
  display,
  reconciliationDelta,
  salesSummaryGratuityTotal,
  reportNetGratuityCollected,
}: Props) {
  const { t } = useAppTranslation();
  const [sortKey, setSortKey] = useState<GratuitySalesSortKey>("gratuityCollected");
  const [sortDir, setSortDir] = useState<GratuitySalesSortDir>("desc");
  const [collapsedGratuityKeys, setCollapsedGratuityKeys] = useState<Set<string>>(() => new Set());

  const rateCounts = useMemo(() => rateCountByGratuity(display.rates), [display.rates]);

  const displayRows = useMemo(() => {
    const sortedGratuities = sortGratuitySalesGratuities(display.gratuities, sortKey, sortDir);
    return rebuildGratuityDisplayRows(sortedGratuities, display.rates);
  }, [display.gratuities, display.rates, sortKey, sortDir]);

  const visibleRows = useMemo(() => {
    const result: typeof displayRows = [];
    for (const row of displayRows) {
      if (row.rowKind === "gratuity") {
        result.push(row);
        continue;
      }
      const key = gratuityRowKey(row.catalogGratuityId, row.gratuityName);
      if (!collapsedGratuityKeys.has(key)) {
        result.push(row);
      }
    }
    return result;
  }, [displayRows, collapsedGratuityKeys]);

  const toggleGratuityExpanded = (catalogGratuityId: string | null, gratuityName: string) => {
    const key = gratuityRowKey(catalogGratuityId, gratuityName);
    setCollapsedGratuityKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSort = (key: GratuitySalesSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "gratuityName" ? "asc" : "desc");
  };

  if (display.gratuities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("reports.gratuitySales.empty", "No gratuity collected in this period.")}
      </p>
    );
  }

  const headerBtn = (key: GratuitySalesSortKey, label: string, align: "left" | "right") => (
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
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2.5 text-left">
                  {headerBtn(
                    "gratuityName",
                    t("reports.gratuitySales.colGratuityName", "Name"),
                    "left",
                  )}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-left">
                  {t("reports.gratuitySales.colRate", "Rate")}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "gratuityCollected",
                    t("reports.gratuitySales.colGratuityCollected", "Gratuity Collected"),
                    "right",
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <GratuitySalesTableRow
                  key={
                    row.rowKind === "gratuity"
                      ? `gratuity-${row.catalogGratuityId ?? "unknown"}-${row.gratuityName}`
                      : `rate-${row.catalogGratuityId ?? "unknown"}-${row.rateLabel}-${index}`
                  }
                  row={row}
                  parentRateLabel={
                    row.rowKind === "gratuity"
                      ? parentRateLabel(row, display.rates)
                      : undefined
                  }
                  isExpanded={
                    row.rowKind === "gratuity"
                      ? !collapsedGratuityKeys.has(
                          gratuityRowKey(row.catalogGratuityId, row.gratuityName),
                        )
                      : undefined
                  }
                  hasChildren={
                    row.rowKind === "gratuity"
                      ? (rateCounts.get(
                          gratuityRowKey(row.catalogGratuityId, row.gratuityName),
                        ) ?? 0) > 0
                      : undefined
                  }
                  onToggle={
                    row.rowKind === "gratuity"
                      ? () => toggleGratuityExpanded(row.catalogGratuityId, row.gratuityName)
                      : undefined
                  }
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td className="px-3 py-3 text-sm">
                  {t("reports.gratuitySales.totalGratuityCollected", "Total Gratuity Collected")}
                </td>
                <td className="border-l border-border/60 px-3 py-3" />
                <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
                  {formatReportsMoney(display.grandTotal.gratuityCollected)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <GratuitySalesReconciliationNote
        reconciliationDelta={reconciliationDelta}
        salesSummaryGratuityTotal={salesSummaryGratuityTotal}
        reportNetGratuityCollected={reportNetGratuityCollected}
        hasBackfillEstimate={display.hasBackfillEstimate}
      />
    </div>
  );
}
