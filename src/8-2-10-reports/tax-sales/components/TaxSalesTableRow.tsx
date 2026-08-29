import { ChevronDown, ChevronRight } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { TaxSalesDisplayRow } from "../lib/taxSalesTypes";

type Props = {
  row: TaxSalesDisplayRow;
  parentRateLabel?: string;
  isExpanded?: boolean;
  hasChildren?: boolean;
  onToggle?: () => void;
};

function MetricsCells({
  row,
}: {
  row: Pick<TaxSalesDisplayRow, "taxableAmount" | "taxCollected">;
}) {
  return (
    <>
      <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
        {formatReportsMoney(row.taxableAmount)}
      </td>
      <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
        {formatReportsMoney(row.taxCollected)}
      </td>
    </>
  );
}

export function TaxSalesTableRow({
  row,
  parentRateLabel = "—",
  isExpanded,
  hasChildren,
  onToggle,
}: Props) {
  const { t } = useAppTranslation();

  if (row.rowKind === "tax") {
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
                  ? t("reports.taxSales.collapseTax", "Collapse {{name}}", { name: row.taxName })
                  : t("reports.taxSales.expandTax", "Expand {{name}}", { name: row.taxName })
              }
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span>{row.taxName}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 pl-5">{row.taxName}</span>
          )}
        </td>
        <td className="border-l border-border/60 px-3 py-3 text-sm text-muted-foreground">
          {parentRateLabel}
        </td>
        <MetricsCells row={row} />
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/60 hover:bg-muted/10">
      <td className={cn("px-3 py-2.5 pl-8 text-sm text-muted-foreground")}>
        <span className="sr-only">
          {t("reports.taxSales.rateUnderTax", "Rate under {{name}}", { name: row.taxName })}
        </span>
        {row.taxName}
      </td>
      <td className="border-l border-border/60 px-3 py-2.5 text-sm">{row.rateLabel}</td>
      <MetricsCells row={row} />
    </tr>
  );
}
