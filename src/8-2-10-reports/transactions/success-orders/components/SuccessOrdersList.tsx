import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import { TransactionsDateGroupHeader } from "../../shared/components/TransactionsDateGroupHeader";
import { TransactionReceiptDialog, formatTransactionListTime } from "../../shared/components/TransactionReceiptDialog";
import { TransactionsSummaryBar } from "../../shared/components/TransactionsSummaryBar";
import type { DateGroupedRow, SuccessOrderRow, SuccessOrdersSummary } from "../../shared/lib/transactionsTypes";

type Props = {
  groups: DateGroupedRow<SuccessOrderRow>[];
  summary: SuccessOrdersSummary;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
};

export function SuccessOrdersList({
  groups,
  summary,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: Props) {
  const { t } = useAppTranslation();
  const [selected, setSelected] = useState<SuccessOrderRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (groups.length === 0) {
    return (
      <>
        <TransactionsSummaryBar summary={summary} />
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-900">
            {t("reports.transactions.empty.success", "No Transactions")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "reports.transactions.empty.successHint",
              "Successful checkouts in the selected period will appear here.",
            )}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <TransactionsSummaryBar summary={summary} />
      <div className="overflow-hidden rounded-md border border-border">
        <div className="hidden border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[4rem_1fr_6rem_1fr_5rem] sm:gap-3">
          <span>{t("reports.transactions.columns.time", "Time")}</span>
          <span>{t("reports.transactions.columns.outlet", "Outlet")}</span>
          <span>{t("reports.transactions.columns.collectedBy", "Collected By")}</span>
          <span>{t("reports.transactions.columns.items", "Items")}</span>
          <span className="text-right">{t("reports.transactions.columns.total", "Total")}</span>
        </div>
        {groups.map((group) => (
          <div key={group.dateKey}>
            <TransactionsDateGroupHeader dateLabel={group.dateLabel} dayTotal={group.dayTotal} />
            {group.rows.map((row, index) => (
              <button
                key={row.activityId}
                type="button"
                onClick={() => {
                  setSelected(row);
                  setDialogOpen(true);
                }}
                className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm last:border-b-0 hover:bg-muted/30 sm:grid sm:grid-cols-[4rem_1fr_6rem_1fr_5rem] ${
                  index % 2 === 1 ? "bg-muted/10" : ""
                }`}
              >
                <span className="shrink-0 text-muted-foreground">
                  {formatTransactionListTime(row.createdAt)}
                </span>
                <span className="min-w-0 truncate">{row.outletName}</span>
                <span className="hidden min-w-0 truncate sm:inline">{row.collectedByName}</span>
                <span className="min-w-0 truncate text-muted-foreground">
                  {row.itemSummary || "—"}
                </span>
                <span className="shrink-0 text-right font-medium tabular-nums">
                  {formatReportsMoney(row.totalCollected)}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoadingMore}
            onClick={() => onLoadMore?.()}
          >
            {isLoadingMore
              ? t("common.loading", "Loading…")
              : t("reports.transactions.loadMore", "Load more")}
          </Button>
        </div>
      ) : null}
      <TransactionReceiptDialog
        row={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
