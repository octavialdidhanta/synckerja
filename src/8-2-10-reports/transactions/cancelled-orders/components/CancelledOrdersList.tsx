import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import { CancelledBillDetailDialog } from "../../shared/components/CancelledBillDetailDialog";
import { TransactionsDateGroupHeader } from "../../shared/components/TransactionsDateGroupHeader";
import { formatTransactionListTime } from "../../shared/components/TransactionReceiptDialog";
import type { CancelledOrderRow } from "../../shared/lib/transactionsTypes";
import { computeCartSnapshotTotal } from "../../shared/lib/computeCartSnapshotTotal";
import type { DateGroupedRow } from "../../shared/lib/transactionsTypes";

type Props = {
  groups: DateGroupedRow<CancelledOrderRow>[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
};

export function CancelledOrdersList({
  groups,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: Props) {
  const { t } = useAppTranslation();
  const [selected, setSelected] = useState<CancelledOrderRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm font-medium text-gray-900">
          {t("reports.transactions.empty.cancelled", "No cancelled orders")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "reports.transactions.empty.cancelledHint",
            "Cancelled bills in the selected period will appear here.",
          )}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border">
        {groups.map((group) => (
          <div key={group.dateKey}>
            <TransactionsDateGroupHeader dateLabel={group.dateLabel} dayTotal={group.dayTotal} />
            {group.rows.map((row, index) => (
              <button
                key={row.sessionId}
                type="button"
                onClick={() => {
                  setSelected(row);
                  setDialogOpen(true);
                }}
                className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm last:border-b-0 hover:bg-muted/30 ${
                  index % 2 === 1 ? "bg-muted/10" : ""
                }`}
              >
                <span className="w-24 shrink-0 text-muted-foreground">
                  {formatTransactionListTime(row.closedAt)}
                </span>
                <span className="min-w-0 flex-1 truncate">{row.outletName}</span>
                <span className="hidden w-16 shrink-0 truncate sm:inline">{row.tableName}</span>
                <span className="hidden min-w-0 flex-[2] truncate text-muted-foreground md:inline">
                  {row.itemSummary || "—"}
                </span>
                <span className="hidden w-28 shrink-0 truncate lg:inline">{row.staffName}</span>
                <span className="w-24 shrink-0 truncate text-right tabular-nums">
                  {formatReportsMoney(computeCartSnapshotTotal(row.cartSnapshot))}
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
      <CancelledBillDetailDialog
        row={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
