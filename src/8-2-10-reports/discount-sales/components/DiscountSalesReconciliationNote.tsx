import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";

type Props = {
  reconciliationDelta: number;
  salesSummaryDiscountTotal: number;
  reportNetDiscount: number;
};

export function DiscountSalesReconciliationNote({
  reconciliationDelta,
  salesSummaryDiscountTotal,
  reportNetDiscount,
}: Props) {
  const { t } = useAppTranslation();

  if (reconciliationDelta <= 1) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        {t(
          "reports.discountSales.footnoteLineItem",
          "Counts reflect line-item discount applications. Totals reconcile with Sales Summary discounts for this period.",
        )}
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
      <p className="font-medium">
        {t("reports.discountSales.reconcileTitle", "Reconciliation notice")}
      </p>
      <p className="mt-1">
        {t(
          "reports.discountSales.reconcileBody",
          "Report net discount ({{report}}) differs from Sales Summary discounts ({{summary}}) by {{delta}}. Historical walk-in checkouts or sessions without cart snapshots may not appear until new checkouts are recorded.",
          {
            report: formatReportsMoney(reportNetDiscount, { asDeduction: true }),
            summary: formatReportsMoney(salesSummaryDiscountTotal, { asDeduction: true }),
            delta: formatReportsMoney(reconciliationDelta),
          },
        )}
      </p>
      <p className="mt-1 text-muted-foreground">
        {t(
          "reports.discountSales.refundNote",
          "Full refunds only are reflected in refund columns; partial refunds are excluded in this version.",
        )}
      </p>
    </div>
  );
}
