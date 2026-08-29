import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  collectorKey,
  defaultExpandedStaffKey,
  sortCollectedByStaff,
} from "../lib/computeCollectedBySalesDisplay";
import type {
  CollectedBySalesDisplay,
  CollectedBySalesSortDir,
  CollectedBySalesSortKey,
} from "../lib/collectedBySalesTypes";
import {
  CollectedBySalesGrandTotalRow,
  CollectedBySalesStaffBlock,
} from "./CollectedBySalesStaffBlock";
import { CollectedBySalesReconciliationNote } from "./CollectedBySalesReconciliationNote";

type Props = {
  display: CollectedBySalesDisplay;
  reconciliationDelta: number;
  salesSummaryTotalCollected: number;
};

function SortIcon({ active, dir }: { active: boolean; dir: CollectedBySalesSortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden />
  );
}

export function CollectedBySalesTable({
  display,
  reconciliationDelta,
  salesSummaryTotalCollected,
}: Props) {
  const { t } = useAppTranslation();
  const [sortKey, setSortKey] = useState<CollectedBySalesSortKey>("totalCollected");
  const [sortDir, setSortDir] = useState<CollectedBySalesSortDir>("desc");
  const [expandedKey, setExpandedKey] = useState<string | null>(() =>
    defaultExpandedStaffKey(display),
  );

  const sortedStaff = useMemo(
    () => sortCollectedByStaff(display.staff, sortKey, sortDir),
    [display.staff, sortKey, sortDir],
  );

  const toggleSort = (key: CollectedBySalesSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "collectorName" ? "asc" : "desc");
  };

  const toggleStaff = (userId: string | null) => {
    const key = collectorKey(userId);
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  if (display.staff.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("reports.collectedBySales.empty", "No collections recorded in this period.")}
      </p>
    );
  }

  const headerBtn = (key: CollectedBySalesSortKey, label: string, align: "left" | "right") => (
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
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2.5 text-left">
                {headerBtn(
                  "collectorName",
                  t("reports.collectedBySales.columns.collectedBy", "Collected By"),
                  "left",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "transactionCount",
                  t("reports.collectedBySales.columns.transactions", "Number of Transactions"),
                  "right",
                )}
              </th>
              <th className="px-3 py-2.5 text-right">
                {headerBtn(
                  "totalCollected",
                  t("reports.collectedBySales.columns.totalCollected", "Total Collected"),
                  "right",
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedStaff.map((block) => {
              const key = collectorKey(block.collectorUserId);
              return (
                <CollectedBySalesStaffBlock
                  key={key}
                  block={block}
                  expanded={expandedKey === key}
                  onToggle={() => toggleStaff(block.collectorUserId)}
                />
              );
            })}
            <CollectedBySalesGrandTotalRow
              label={t("reports.collectedBySales.grandTotal", "Grand Total")}
              transactionCount={display.grandTotal.transactionCount}
              totalCollected={display.grandTotal.totalCollected}
            />
          </tbody>
        </table>
      </div>
      <CollectedBySalesReconciliationNote
        display={display}
        reconciliationDelta={reconciliationDelta}
        salesSummaryTotalCollected={salesSummaryTotalCollected}
      />
    </div>
  );
}
