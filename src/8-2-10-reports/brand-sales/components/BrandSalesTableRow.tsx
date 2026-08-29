import { ChevronDown, ChevronRight } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { formatBrandItemDisplayName } from "../lib/computeBrandSalesDisplay";
import type { BrandSalesDisplayRow } from "../lib/brandSalesTypes";

type Props = {
  row: BrandSalesDisplayRow;
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
    BrandSalesDisplayRow,
    "qtySold" | "qtyRefunded" | "grossSales" | "discountAmount" | "refundAmount" | "netSales" | "grossProfit"
  >;
}) {
  return (
    <>
      <td className="px-3 py-3 text-right text-sm tabular-nums">{formatQty(row.qtySold)}</td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">{formatQty(row.qtyRefunded)}</td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">
        {formatReportsMoney(row.grossSales)}
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">
        {formatDeduction(row.discountAmount)}
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">
        {formatDeduction(row.refundAmount)}
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">
        {formatReportsMoney(row.netSales)}
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">
        {formatReportsMoney(row.grossProfit)}
      </td>
    </>
  );
}

export function BrandSalesTableRow({ row, isExpanded, hasChildren, onToggle }: Props) {
  const { t } = useAppTranslation();

  if (row.rowKind === "brand") {
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
                  ? t("reports.brandSales.collapseBrand", "Collapse {{brand}}", {
                      brand: row.brandName,
                    })
                  : t("reports.brandSales.expandBrand", "Expand {{brand}}", {
                      brand: row.brandName,
                    })
              }
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span>{row.brandName}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 pl-5">{row.brandName}</span>
          )}
        </td>
        <MetricsCells row={row} />
      </tr>
    );
  }

  const label = formatBrandItemDisplayName(row);
  return (
    <tr className="border-b border-border/60 hover:bg-muted/10">
      <td className={cn("px-3 py-2.5 pl-8 text-sm text-muted-foreground")}>
        <span className="sr-only">
          {t("reports.brandSales.itemUnderBrand", "Item under {{brand}}", {
            brand: row.brandName,
          })}
        </span>
        {label}
      </td>
      <MetricsCells row={row} />
    </tr>
  );
}
