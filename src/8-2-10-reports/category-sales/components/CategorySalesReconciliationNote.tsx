import { CheckCircle2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { CategorySalesDisplay } from "../lib/categorySalesTypes";

type Props = {
  display: CategorySalesDisplay;
};

export function CategorySalesReconciliationNote({ display }: Props) {
  const { t } = useAppTranslation();
  if (display.grandTotal.netSales <= 0 && display.summaryProductNetSales <= 0) {
    return null;
  }

  return (
    <div className="space-y-1 border-t border-border bg-muted/10 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
      <p
        className={cn(
          "flex items-start gap-1.5",
          display.reconciliationOk && "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {display.reconciliationOk ? (
          <>
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {t(
                "reports.categorySales.reconciliationOk",
                "Net Sales (categories) = product net sales ({{amount}}).",
                { amount: formatReportsMoney(display.summaryProductNetSales) },
              )}
            </span>
          </>
        ) : (
          t(
            "reports.categorySales.reconciliationMismatch",
            "Category net sales may not match product net if line categorization differs from Item Sales totals.",
          )
        )}
      </p>
      {display.grandTotal.qtyRefunded > 0 || display.grandTotal.refundAmount > 0 ? (
        <p>
          {t(
            "reports.categorySales.refundFootnote",
            "Items Refunded counts units refunded in this period; Refunds (Rp) is the monetary refund allocated by category.",
          )}
        </p>
      ) : null}
    </div>
  );
}
