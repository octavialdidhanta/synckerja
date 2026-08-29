import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { sortSalesTypeRows } from "../lib/computeSalesTypeDisplay";
import type { SalesTypeDisplay, SalesTypeSortDir, SalesTypeSortKey } from "../lib/salesTypeTypes";
import { SalesTypeReconciliationNote } from "./SalesTypeReconciliationNote";
import { SalesTypeRowView } from "./SalesTypeRow";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";

type Props = {
  display: SalesTypeDisplay;
};

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: SalesTypeSortDir;
}) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden />
  );
}

export function SalesTypeTable({ display }: Props) {
  const { t } = useAppTranslation();
  const [sortKey, setSortKey] = useState<SalesTypeSortKey>("netSales");
  const [sortDir, setSortDir] = useState<SalesTypeSortDir>("desc");

  const sortedRows = useMemo(
    () => sortSalesTypeRows(display.rows, sortKey, sortDir),
    [display.rows, sortKey, sortDir],
  );

  const toggleSort = (key: SalesTypeSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "name" ? "asc" : "desc");
  };

  if (display.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("reports.salesType.empty", "No sales recorded in this period.")}
      </p>
    );
  }

  const headerBtn = (key: SalesTypeSortKey, label: string, align: "left" | "right") => (
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
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2.5 text-left">
                {headerBtn("name", t("reports.salesType.colSalesType", "Sales Type"), "left")}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "transactionCount",
                  t("reports.salesType.colTransactions", "Count"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "grossSales",
                  t("reports.salesType.colGrossSales", "Gross Sales"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "netSales",
                  t("reports.salesType.colNetSales", "Net Sales"),
                  "right",
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <SalesTypeRowView key={row.salesTypeId ?? "unassigned"} row={row} />
            ))}
            <tr className="border-t-2 border-border bg-muted/30 font-semibold">
              <td className="px-3 py-3 text-sm">
                {t("reports.salesType.grandTotal", "Grand Total")}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">
                {display.grandTotal.transactionCount}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">
                {formatReportsMoney(display.grandTotal.grossSales)}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">
                {formatReportsMoney(display.grandTotal.netSales)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <SalesTypeReconciliationNote display={display} />
    </div>
  );
}
