import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";

type Props = {
  reconciliationDelta: number;
  salesSummaryTaxTotal: number;
  reportNetTaxCollected: number;
  hasBackfillEstimate: boolean;
};

export function TaxSalesReconciliationNote({
  reconciliationDelta,
  salesSummaryTaxTotal,
  reportNetTaxCollected,
  hasBackfillEstimate,
}: Props) {
  const { t } = useAppTranslation();

  const footnotes: string[] = [];

  if (reconciliationDelta <= 1) {
    footnotes.push(
      t(
        "reports.taxSales.footnoteBillLevel",
        "Taxable amount reflects the catalog tax base (DPP) at checkout. Total tax collected reconciles with Sales Summary tax for this period.",
      ),
    );
  } else {
    footnotes.push(
      t(
        "reports.taxSales.reconcileBody",
        "Report net tax collected ({{report}}) differs from Sales Summary tax ({{summary}}) by {{delta}}.",
        {
          report: formatReportsMoney(reportNetTaxCollected),
          summary: formatReportsMoney(salesSummaryTaxTotal),
          delta: formatReportsMoney(reconciliationDelta),
        },
      ),
    );
  }

  footnotes.push(
    t(
      "reports.taxSales.refundNote",
      "Full refunds only are reflected in net totals; partial refunds are excluded in this version.",
    ),
  );

  if (hasBackfillEstimate) {
    footnotes.push(
      t(
        "reports.taxSales.backfillEstimateNote",
        "Some historical rows use estimated taxable amounts derived from collected tax and rate; new checkouts store exact DPP.",
      ),
    );
  }

  if (reconciliationDelta > 1) {
    return (
      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
        <p className="font-medium">{t("reports.taxSales.reconcileTitle", "Reconciliation notice")}</p>
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
