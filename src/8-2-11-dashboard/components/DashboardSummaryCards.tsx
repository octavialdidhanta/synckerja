import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatSalesSummaryMoney } from "@/8-2-10-reports/sales-summary/lib/computeSalesSummaryDisplay";
import type { SalesSummaryMetrics } from "@/8-2-10-reports/sales-summary/lib/salesSummaryTypes";

type Props = {
  metrics: SalesSummaryMetrics;
};

export function DashboardSummaryCards({ metrics }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("operationsDashboard.cards.netSales", "Net Sales")}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
          {formatSalesSummaryMoney(metrics.netSales)}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("operationsDashboard.cards.totalCollected", "Total Collected")}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-primary">
          {formatSalesSummaryMoney(metrics.totalCollected)}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("operationsDashboard.cards.refunds", "Refunds")}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-700">
          {formatSalesSummaryMoney(metrics.refunds, { asDeduction: true })}
        </p>
      </div>
    </div>
  );
}
