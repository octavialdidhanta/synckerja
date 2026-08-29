import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import type { SuccessOrdersSummary } from "../lib/transactionsTypes";

type Props = {
  summary: SuccessOrdersSummary;
};

export function TransactionsSummaryBar({ summary }: Props) {
  const { t } = useAppTranslation();

  const items = [
    {
      label: t("reports.transactions.summary.transactions", "Transactions"),
      value: String(summary.transactionCount),
    },
    {
      label: t("reports.transactions.summary.totalCollected", "Total Collected"),
      value: formatReportsMoney(summary.totalCollected),
    },
    {
      label: t("reports.transactions.summary.netSales", "Net Sales"),
      value: formatReportsMoney(summary.netSales),
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-border bg-muted/20 px-4 py-3"
        >
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
