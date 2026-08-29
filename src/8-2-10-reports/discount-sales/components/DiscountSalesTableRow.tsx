import { ChevronDown, ChevronRight } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { DiscountSalesDisplayRow } from "../lib/discountSalesTypes";

type Props = {
  row: DiscountSalesDisplayRow;
  parentValueLabel?: string;
  isExpanded?: boolean;
  hasChildren?: boolean;
  onToggle?: () => void;
};

function formatCount(value: number): string {
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
    DiscountSalesDisplayRow,
    "timesApplied" | "grossDiscount" | "refundAmount" | "netDiscount"
  >;
}) {
  return (
    <>
      <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
        {formatCount(row.timesApplied)}
      </td>
      <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
        {formatDeduction(row.grossDiscount)}
      </td>
      <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
        {formatDeduction(row.refundAmount)}
      </td>
      <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
        {formatDeduction(row.netDiscount)}
      </td>
    </>
  );
}

export function DiscountSalesTableRow({
  row,
  parentValueLabel = "—",
  isExpanded,
  hasChildren,
  onToggle,
}: Props) {
  const { t } = useAppTranslation();

  if (row.rowKind === "discount") {
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
                  ? t("reports.discountSales.collapseDiscount", "Collapse {{name}}", {
                      name: row.discountName,
                    })
                  : t("reports.discountSales.expandDiscount", "Expand {{name}}", {
                      name: row.discountName,
                    })
              }
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span>{row.discountName}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 pl-5">{row.discountName}</span>
          )}
        </td>
        <td className="border-l border-border/60 px-3 py-3 text-sm text-muted-foreground">
          {parentValueLabel}
        </td>
        <MetricsCells row={row} />
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/60 hover:bg-muted/10">
      <td className={cn("px-3 py-2.5 pl-8 text-sm text-muted-foreground")}>
        <span className="sr-only">
          {t("reports.discountSales.valueUnderDiscount", "Value under {{name}}", {
            name: row.discountName,
          })}
        </span>
        {row.discountName}
      </td>
      <td className="border-l border-border/60 px-3 py-2.5 text-sm">{row.valueLabel}</td>
      <MetricsCells row={row} />
    </tr>
  );
}
