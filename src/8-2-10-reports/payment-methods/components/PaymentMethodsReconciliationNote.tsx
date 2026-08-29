import { CheckCircle2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { PaymentMethodsDisplay } from "../lib/paymentMethodsTypes";

type Props = {
  display: PaymentMethodsDisplay;
};

export function PaymentMethodsReconciliationNote({ display }: Props) {
  const { t } = useAppTranslation();
  if (display.grandTotal.totalCollected <= 0 && display.summaryTotalCollected <= 0) {
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
              "reports.paymentMethods.reconciliationMatch",
              "Total Collected (payment methods) = Sales Summary Total Collected ({{amount}}).",
              { amount: formatReportsMoney(display.summaryTotalCollected) },
            )}
          </span>
        </>
      ) : (
        t(
          "reports.paymentMethods.reconciliationMismatch",
          "Payment method totals may differ from Sales Summary if unmapped legacy payments exist.",
        )
      )}
    </p>
  );
}
