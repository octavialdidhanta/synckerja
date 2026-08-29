import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import {
  groupRowKey,
  rebuildModifierDisplayRows,
  sortModifierSalesGroups,
} from "../lib/computeModifierSalesDisplay";
import type {
  ModifierSalesDisplay,
  ModifierSalesSortDir,
  ModifierSalesSortKey,
} from "../lib/modifierSalesTypes";
import { ModifierSalesFootnote } from "./ModifierSalesFootnote";
import { ModifierSalesTableRow } from "./ModifierSalesTableRow";

type Props = {
  display: ModifierSalesDisplay;
};

function SortIcon({ active, dir }: { active: boolean; dir: ModifierSalesSortDir }) {
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

export function ModifierSalesTable({ display }: Props) {
  const { t } = useAppTranslation();
  const [sortKey, setSortKey] = useState<ModifierSalesSortKey>("grossSales");
  const [sortDir, setSortDir] = useState<ModifierSalesSortDir>("desc");
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(() => new Set());

  const optionCountByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const option of display.options) {
      const key = groupRowKey(option.groupId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [display.options]);

  const displayRows = useMemo(() => {
    const sortedGroups = sortModifierSalesGroups(display.groups, sortKey, sortDir);
    return rebuildModifierDisplayRows(sortedGroups, display.options);
  }, [display.groups, display.options, sortKey, sortDir]);

  const visibleRows = useMemo(() => {
    const result: typeof displayRows = [];
    for (const row of displayRows) {
      if (row.rowKind === "group") {
        result.push(row);
        continue;
      }
      if (!collapsedGroupKeys.has(groupRowKey(row.groupId))) {
        result.push(row);
      }
    }
    return result;
  }, [displayRows, collapsedGroupKeys]);

  const toggleGroupExpanded = (groupId: string | null) => {
    const key = groupRowKey(groupId);
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSort = (key: ModifierSalesSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "groupName" ? "asc" : "desc");
  };

  if (display.groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("reports.modifierSales.empty", "No modifier sales in this period.")}
      </p>
    );
  }

  const headerBtn = (key: ModifierSalesSortKey, label: string, align: "left" | "right") => (
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
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2.5 text-left">
                  {headerBtn("groupName", t("reports.modifierSales.colName", "Name"), "left")}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "qtySold",
                    t("reports.modifierSales.colQtySold", "Qty Sold"),
                    "right",
                  )}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "grossSales",
                    t("reports.modifierSales.colGrossSales", "Gross Sales"),
                    "right",
                  )}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "discountAmount",
                    t("reports.modifierSales.colDiscount", "Discount"),
                    "right",
                  )}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "refundAmount",
                    t("reports.modifierSales.colRefund", "Refund"),
                    "right",
                  )}
                </th>
                <th className="border-l border-border/60 px-3 py-2.5 text-right">
                  {headerBtn(
                    "netSales",
                    t("reports.modifierSales.colNetSales", "Net Sales"),
                    "right",
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <ModifierSalesTableRow
                  key={
                    row.rowKind === "group"
                      ? `group-${row.groupId ?? "unknown"}`
                      : `option-${row.groupId ?? "unknown"}-${row.optionId}-${index}`
                  }
                  row={row}
                  isExpanded={
                    row.rowKind === "group"
                      ? !collapsedGroupKeys.has(groupRowKey(row.groupId))
                      : undefined
                  }
                  hasChildren={
                    row.rowKind === "group"
                      ? (optionCountByGroup.get(groupRowKey(row.groupId)) ?? 0) > 0
                      : undefined
                  }
                  onToggle={
                    row.rowKind === "group"
                      ? () => toggleGroupExpanded(row.groupId)
                      : undefined
                  }
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td className="px-3 py-3 text-sm">
                  {t("reports.modifierSales.grandTotal", "Grand Total")}
                </td>
                <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
                  {formatQty(display.grandTotal.qtySold)}
                </td>
                <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
                  {formatReportsMoney(display.grandTotal.grossSales)}
                </td>
                <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
                  {formatDeduction(display.grandTotal.discountAmount)}
                </td>
                <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
                  {formatDeduction(display.grandTotal.refundAmount)}
                </td>
                <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
                  {formatReportsMoney(display.grandTotal.netSales)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <ModifierSalesFootnote />
    </div>
  );
}
