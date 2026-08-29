import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";

type Props = {
  reconciliationDelta: number;
  salesSummaryGratuityTotal: number;
  reportNetGratuityCollected: number;
  hasBackfillEstimate: boolean;
};

export function GratuitySalesReconciliationNote({
  reconciliationDelta,
  salesSummaryGratuityTotal,
  reportNetGratuityCollected,
  hasBackfillEstimate,
}: Props) {
  const { t } = useAppTranslation();

  const footnotes: string[] = [];

  if (reconciliationDelta <= 1) {
    footnotes.push(
      t(
        "reports.gratuitySales.footnoteBillLevel",
        "Gratuity collected per service charge rule. Totals reconcile with Sales Summary gratuity for this period.",
      ),
    );
  } else {
    footnotes.push(
      t(
        "reports.gratuitySales.reconcileBody",
        "Report net gratuity collected ({{report}}) differs from Sales Summary gratuity ({{summary}}) by {{delta}}.",
        {
          report: formatReportsMoney(reportNetGratuityCollected),
          summary: formatReportsMoney(salesSummaryGratuityTotal),
          delta: formatReportsMoney(reconciliationDelta),
        },
      ),
    );
  }

  footnotes.push(
    t(
      "reports.gratuitySales.refundNote",
      "Full refunds only are reflected in net totals; partial refunds are excluded in this version.",
    ),
  );

  if (hasBackfillEstimate) {
    footnotes.push(
      t(
        "reports.gratuitySales.backfillEstimateNote",
        "Some historical rows use estimated gratuity breakdown from stored totals and catalog rules; new checkouts store exact per-gratuity amounts.",
      ),
    );
  }

  if (reconciliationDelta > 1) {
    return (
      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
        <p className="font-medium">
          {t("reports.gratuitySales.reconcileTitle", "Reconciliation notice")}
        </p>
        {footnotes.map((text, i) => (
          <p key={i} className={i === 0 ? "mt-1" : "mt-1 text-muted-foreground"}>
            {text}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      {footnotes.map((text, i) => (
        <p key={i}>{text}</p>
      ))}
    </div>
  );
}
