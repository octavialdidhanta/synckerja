import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  defaultExpandedServerKey,
  serverKey,
  sortServedByServers,
} from "../lib/computeServedBySalesDisplay";
import type {
  ServedBySalesDisplay,
  ServedBySalesSortDir,
  ServedBySalesSortKey,
} from "../lib/servedBySalesTypes";
import {
  ServedBySalesGrandTotalRow,
  ServedBySalesServerBlock,
} from "./ServedBySalesServerBlock";
import { ServedBySalesReconciliationNote } from "./ServedBySalesReconciliationNote";

type Props = {
  display: ServedBySalesDisplay;
  reconciliationDeltaGross: number;
  reconciliationDeltaNet: number;
  salesSummaryGrossSales: number;
  salesSummaryNetSales: number;
};

function SortIcon({ active, dir }: { active: boolean; dir: ServedBySalesSortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden />
  );
}

export function ServedBySalesTable({
  display,
  reconciliationDeltaGross,
  reconciliationDeltaNet,
  salesSummaryGrossSales,
  salesSummaryNetSales,
}: Props) {
  const { t } = useAppTranslation();
  const [sortKey, setSortKey] = useState<ServedBySalesSortKey>("netSales");
  const [sortDir, setSortDir] = useState<ServedBySalesSortDir>("desc");
  const [expandedKey, setExpandedKey] = useState<string | null>(() =>
    defaultExpandedServerKey(display),
  );

  const sortedServers = useMemo(
    () => sortServedByServers(display.servers, sortKey, sortDir),
    [display.servers, sortKey, sortDir],
  );

  const toggleSort = (key: ServedBySalesSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "serverName" ? "asc" : "desc");
  };

  const toggleServer = (userId: string | null) => {
    const key = serverKey(userId);
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  if (display.servers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("reports.servedBySales.empty", "No served-by sales recorded in this period.")}
      </p>
    );
  }

  const headerBtn = (key: ServedBySalesSortKey, label: string, align: "left" | "right") => (
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
                {headerBtn(
                  "serverName",
                  t("reports.servedBySales.columns.servedBy", "Served By"),
                  "left",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "transactionCount",
                  t("reports.servedBySales.columns.transactions", "Number of Transactions"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "grossSales",
                  t("reports.servedBySales.columns.grossSales", "Gross Sales"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "netSales",
                  t("reports.servedBySales.columns.netSales", "Net Sales"),
                  "right",
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedServers.map((block) => {
              const key = serverKey(block.serverUserId);
              return (
                <ServedBySalesServerBlock
                  key={key}
                  block={block}
                  expanded={expandedKey === key}
                  onToggle={() => toggleServer(block.serverUserId)}
                />
              );
            })}
            <ServedBySalesGrandTotalRow
              label={t("reports.servedBySales.grandTotal", "Grand Total")}
              transactionCount={display.grandTotal.transactionCount}
              grossSales={display.grandTotal.grossSales}
              netSales={display.grandTotal.netSales}
            />
          </tbody>
        </table>
      </div>
      <ServedBySalesReconciliationNote
        display={display}
        reconciliationDeltaGross={reconciliationDeltaGross}
        reconciliationDeltaNet={reconciliationDeltaNet}
        salesSummaryGrossSales={salesSummaryGrossSales}
        salesSummaryNetSales={salesSummaryNetSales}
      />
    </div>
  );
}
