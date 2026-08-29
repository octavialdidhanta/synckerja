import { ChevronDown, ChevronRight } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { ModifierSalesDisplayRow } from "../lib/modifierSalesTypes";

type Props = {
  row: ModifierSalesDisplayRow;
  isExpanded?: boolean;
  hasChildren?: boolean;
  onToggle?: () => void;
};

function formatQty(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatDeduction(amount: number): string {
  return formatReportsMoney(amount, { asDeduction: true });
}

function MetricsCells({
  row,
}: {
  row: Pick<
    ModifierSalesDisplayRow,
    "qtySold" | "grossSales" | "discountAmount" | "refundAmount" | "netSales"
  >;
}) {
  return (
    <>
      <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
        {formatQty(row.qtySold)}
      </td>
      <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
        {formatReportsMoney(row.grossSales)}
      </td>
      <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
        {formatDeduction(row.discountAmount)}
      </td>
      <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
        {formatDeduction(row.refundAmount)}
      </td>
      <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
        {formatReportsMoney(row.netSales)}
      </td>
    </>
  );
}

export function ModifierSalesTableRow({ row, isExpanded, hasChildren, onToggle }: Props) {
  const { t } = useAppTranslation();

  if (row.rowKind === "group") {
    const canToggle = Boolean(hasChildren && onToggle);
    const expanded = isExpanded ?? true;

    return (
      <tr className="border-b border-border/60 bg-muted/20 font-medium">
        <td className="px-3 py-3 text-sm">
          {canToggle ? (
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex w-full items-center gap-1.5 text-left hover:text-primary"
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? t("reports.modifierSales.collapseGroup", "Collapse {{group}}", {
                      group: row.groupName,
                    })
                  : t("reports.modifierSales.expandGroup", "Expand {{group}}", {
                      group: row.groupName,
                    })
              }
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span>{row.groupName}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 pl-5">{row.groupName}</span>
          )}
        </td>
        <MetricsCells row={row} />
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/60 hover:bg-muted/10">
      <td className={cn("px-3 py-2.5 pl-8 text-sm text-muted-foreground")}>
        <span className="sr-only">
          {t("reports.modifierSales.optionUnderGroup", "Option under {{group}}", {
            group: row.groupName,
          })}
        </span>
        {row.optionName}
      </td>
      <MetricsCells row={row} />
    </tr>
  );
}
