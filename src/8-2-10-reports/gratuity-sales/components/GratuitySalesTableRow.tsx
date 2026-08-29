import { ChevronDown, ChevronRight } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { GratuitySalesDisplayRow } from "../lib/gratuitySalesTypes";

type Props = {
  row: GratuitySalesDisplayRow;
  parentRateLabel?: string;
  isExpanded?: boolean;
  hasChildren?: boolean;
  onToggle?: () => void;
};

export function GratuitySalesTableRow({
  row,
  parentRateLabel = "—",
  isExpanded,
  hasChildren,
  onToggle,
}: Props) {
  const { t } = useAppTranslation();

  if (row.rowKind === "gratuity") {
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
                  ? t("reports.gratuitySales.collapseGratuity", "Collapse {{name}}", {
                      name: row.gratuityName,
                    })
                  : t("reports.gratuitySales.expandGratuity", "Expand {{name}}", {
                      name: row.gratuityName,
                    })
              }
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span>{row.gratuityName}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 pl-5">{row.gratuityName}</span>
          )}
        </td>
        <td className="border-l border-border/60 px-3 py-3 text-sm text-muted-foreground">
          {parentRateLabel}
        </td>
        <td className="border-l border-border/60 px-3 py-3 text-right text-sm tabular-nums">
          {formatReportsMoney(row.gratuityCollected)}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/60 hover:bg-muted/10">
      <td className={cn("px-3 py-2.5 pl-8 text-sm text-muted-foreground")}>
        <span className="sr-only">
          {t("reports.gratuitySales.rateUnderGratuity", "Rate under {{name}}", {
            name: row.gratuityName,
          })}
        </span>
        {row.gratuityName}
      </td>
      <td className="border-l border-border/60 px-3 py-2.5 text-sm">{row.rateLabel}</td>
      <td className="border-l border-border/60 px-3 py-2.5 text-right text-sm tabular-nums">
        {formatReportsMoney(row.gratuityCollected)}
      </td>
    </tr>
  );
}
