import { CheckCircle2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { CollectedBySalesDisplay } from "../lib/collectedBySalesTypes";

type Props = {
  display: CollectedBySalesDisplay;
  reconciliationDelta: number;
  salesSummaryTotalCollected: number;
};

export function CollectedBySalesReconciliationNote({
  display,
  reconciliationDelta,
  salesSummaryTotalCollected,
}: Props) {
  const { t } = useAppTranslation();
  if (display.grandTotal.totalCollected <= 0 && salesSummaryTotalCollected <= 0) {
    return null;
  }

  const matches = reconciliationDelta <= 0.01 && display.matchesSummary;

  return (
    <div className="space-y-1 border-t border-border bg-muted/10 px-3 py-2.5 text-xs leading-relaxed">
      <p
        className={cn(
          "flex items-start gap-1.5",
          matches && "text-emerald-700 dark:text-emerald-400",
          !matches && "text-amber-700 dark:text-amber-400",
        )}
      >
        {matches ? (
          <>
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {t(
                "reports.collectedBySales.reconciliation.note",
                "Totals reconcile with Sales Summary Total Collected ({{amount}}) for this period.",
                { amount: formatReportsMoney(salesSummaryTotalCollected) },
              )}
            </span>
          </>
        ) : (
          t(
            "reports.collectedBySales.reconciliation.deltaWarning",
            "Collected By total differs from Sales Summary by {{amount}}. Check unmapped or legacy payments.",
            { amount: formatReportsMoney(reconciliationDelta) },
          )
        )}
      </p>
      <p className="text-muted-foreground">
        {t(
          "reports.collectedBySales.footnote.shiftLink",
          "Collected By uses the staff account that processed each payment. Compare with Shift report for drawer reconciliation.",
        )}
      </p>
    </div>
  );
}
