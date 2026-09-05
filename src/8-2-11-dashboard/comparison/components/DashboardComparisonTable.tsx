import { Plus } from "lucide-react";
import { formatSalesSummaryMoney } from "@/8-2-10-reports/sales-summary/lib/computeSalesSummaryDisplay";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  DASHBOARD_COMPARE_MAX_OUTLETS,
} from "./DashboardChooseOutletsDialog";
import type { DashboardOutletComparisonRow } from "../hooks/useDashboardOutletComparison";

type Props = {
  rows: DashboardOutletComparisonRow[];
  onAddOutlet: () => void;
  onEditOutlets: () => void;
};

export function DashboardComparisonTable({ rows, onAddOutlet, onEditOutlets }: Props) {
  const { t } = useAppTranslation();
  const canAdd = rows.length < DASHBOARD_COMPARE_MAX_OUTLETS;

  const metricLabels = [
    { key: "grossSales" as const, label: t("operationsDashboard.cards.grossSales", "Gross Sales") },
    { key: "netSales" as const, label: t("operationsDashboard.cards.netSales", "Net Sales") },
    { key: "grossProfit" as const, label: t("operationsDashboard.cards.grossProfit", "Gross Profit") },
    { key: "transactionCount" as const, label: t("operationsDashboard.cards.transactions", "Transactions") },
    {
      key: "avgSale" as const,
      label: t("operationsDashboard.cards.averageSale", "Average Sale per Transaction"),
    },
    { key: "grossMargin" as const, label: t("operationsDashboard.cards.grossMargin", "Gross Margin") },
  ];

  const formatMetric = (row: DashboardOutletComparisonRow, key: (typeof metricLabels)[number]["key"]) => {
    if (key === "transactionCount") return row.transactionCount.toLocaleString("id-ID");
    if (key === "grossMargin") {
      return `${row.grossMargin.toLocaleString("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`;
    }
    return formatSalesSummaryMoney(row[key]);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {t("operationsDashboard.compare.tableTitle", "TABLE SUMMARY")}
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={onEditOutlets}>
          {t("operationsDashboard.compare.editOutlets", "Choose Outlet")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t(
              "operationsDashboard.compare.empty",
              "Select at least two outlets to compare performance.",
            )}
          </p>
          <Button type="button" onClick={onAddOutlet}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("operationsDashboard.compare.addOutlet", "Add Outlet")}
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-3">
            <div className="w-44 shrink-0 space-y-2 pt-10">
              {metricLabels.map((metric) => (
                <div
                  key={metric.key}
                  className="flex h-12 items-center text-xs font-medium text-muted-foreground"
                >
                  {metric.label}
                </div>
              ))}
              <div className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("operationsDashboard.compare.topItems", "Top 3 Items")}
              </div>
            </div>

            {rows.map((row) => (
              <div
                key={row.outletId}
                className="w-48 shrink-0 rounded-lg border border-border bg-background p-3"
              >
                <p className="mb-2 truncate text-sm font-semibold text-foreground" title={row.outletName}>
                  {row.outletName}
                </p>
                <div className="space-y-2">
                  {metricLabels.map((metric) => (
                    <div
                      key={metric.key}
                      className="flex h-12 items-center text-sm font-semibold tabular-nums text-foreground"
                    >
                      {formatMetric(row, metric.key)}
                    </div>
                  ))}
                </div>
                <ul className="mt-3 space-y-1 border-t border-border pt-2">
                  {row.topItems.length === 0 ? (
                    <li className="text-xs text-muted-foreground">—</li>
                  ) : (
                    row.topItems.map((item) => (
                      <li key={`${row.outletId}-${item.name}`} className="text-xs text-foreground">
                        <span className="line-clamp-1">{item.name}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {item.qtySold.toLocaleString("id-ID")}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}

            {canAdd ? (
              <button
                type="button"
                onClick={onAddOutlet}
                className="flex w-40 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Plus className="h-5 w-5" />
                {t("operationsDashboard.compare.addOutlet", "Add Outlet")}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
