import { formatSalesSummaryMoney } from "@/8-2-10-reports/sales-summary/lib/computeSalesSummaryDisplay";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { DashboardSummaryMetrics } from "../hooks/useDashboardSummaryMetrics";

type Props = {
  metrics: DashboardSummaryMetrics;
};

export function DashboardSalesSummaryCards({ metrics }: Props) {
  const { t } = useAppTranslation();
  const cards = [
    {
      label: t("operationsDashboard.cards.grossSales", "Gross Sales"),
      value: formatSalesSummaryMoney(metrics.grossSales),
    },
    {
      label: t("operationsDashboard.cards.netSales", "Net Sales"),
      value: formatSalesSummaryMoney(metrics.netSales),
    },
    {
      label: t("operationsDashboard.cards.grossProfit", "Gross Profit"),
      value: formatSalesSummaryMoney(metrics.grossProfit),
    },
    {
      label: t("operationsDashboard.cards.transactions", "Transactions"),
      value: metrics.transactionCount.toLocaleString("id-ID"),
    },
    {
      label: t(
        "operationsDashboard.cards.averageSale",
        "Average Sale per Transaction",
      ),
      value: formatSalesSummaryMoney(metrics.avgSale),
    },
    {
      label: t("operationsDashboard.cards.grossMargin", "Gross Margin"),
      value: `${metrics.grossMargin.toLocaleString("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`,
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
