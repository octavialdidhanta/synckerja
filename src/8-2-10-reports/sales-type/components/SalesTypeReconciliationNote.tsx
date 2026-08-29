import { CheckCircle2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { SalesTypeDisplay } from "../lib/salesTypeTypes";

type Props = {
  display: SalesTypeDisplay;
};

export function SalesTypeReconciliationNote({ display }: Props) {
  const { t } = useAppTranslation();
  if (display.grandTotal.netSales <= 0 && display.summaryNetSales <= 0) {
    return null;
  }

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 border-t border-border bg-muted/10 px-3 py-2.5 text-xs leading-relaxed",
        display.matchesSummary && "text-emerald-700 dark:text-emerald-400",
        !display.matchesSummary && "text-muted-foreground",
      )}
    >
      {display.matchesSummary ? (
        <>
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {t(
              "reports.salesType.reconciliationMatch",
              "Net Sales (sales types) = Sales Summary Net Sales ({{amount}}).",
              { amount: formatReportsMoney(display.summaryNetSales) },
            )}
          </span>
        </>
      ) : (
        t(
          "reports.salesType.reconciliationMismatch",
          "Sales type totals may differ from Sales Summary if bills have no sales type assigned.",
        )
      )}
    </p>
  );
}
