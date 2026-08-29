import { CheckCircle2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { ServedBySalesDisplay } from "../lib/servedBySalesTypes";

type Props = {
  display: ServedBySalesDisplay;
  reconciliationDeltaGross: number;
  reconciliationDeltaNet: number;
  salesSummaryGrossSales: number;
  salesSummaryNetSales: number;
};

export function ServedBySalesReconciliationNote({
  display,
  reconciliationDeltaGross,
  reconciliationDeltaNet,
  salesSummaryGrossSales,
  salesSummaryNetSales,
}: Props) {
  const { t } = useAppTranslation();
  if (display.grandTotal.netSales <= 0 && salesSummaryNetSales <= 0) {
    return null;
  }

  const matchesGross =
    reconciliationDeltaGross <= 0.01 && display.matchesSummaryGross;
  const matchesNet = reconciliationDeltaNet <= 0.01 && display.matchesSummaryNet;
  const matches = matchesGross && matchesNet;

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
                "reports.servedBySales.reconciliation.note",
                "Totals reconcile with Sales Summary (gross {{gross}}, net {{net}}) for this period.",
                {
                  gross: formatReportsMoney(salesSummaryGrossSales),
                  net: formatReportsMoney(salesSummaryNetSales),
                },
              )}
            </span>
          </>
        ) : (
          t(
            "reports.servedBySales.reconciliation.deltaWarning",
            "Served By totals differ from Sales Summary (gross Δ {{grossDelta}}, net Δ {{netDelta}}). Check unmapped or legacy checkouts.",
            {
              grossDelta: formatReportsMoney(reconciliationDeltaGross),
              netDelta: formatReportsMoney(reconciliationDeltaNet),
            },
          )
        )}
      </p>
      <p className="text-muted-foreground">
        {t(
          "reports.servedBySales.footnote.collectedByLink",
          "Served By uses the waiter assigned at pay. This is distinct from Collected By (who processed payment).",
        )}
      </p>
    </div>
  );
}
