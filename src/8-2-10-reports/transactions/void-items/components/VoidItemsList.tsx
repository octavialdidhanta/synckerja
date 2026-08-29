import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import { TransactionsDateGroupHeader } from "../../shared/components/TransactionsDateGroupHeader";
import { formatTransactionListTime } from "../../shared/components/TransactionReceiptDialog";
import { VoidItemDetailDialog } from "../../shared/components/VoidItemDetailDialog";
import type { DateGroupedRow, VoidItemRow } from "../../shared/lib/transactionsTypes";

type Props = {
  groups: DateGroupedRow<VoidItemRow>[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
};

export function VoidItemsList({ groups, hasMore, isLoadingMore, onLoadMore }: Props) {
  const { t } = useAppTranslation();
  const [selected, setSelected] = useState<VoidItemRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm font-medium text-gray-900">
          {t("reports.transactions.empty.void", "No void items")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "reports.transactions.empty.voidHint",
            "Voided line items in the selected period will appear here.",
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
                key={row.voidId}
                type="button"
                onClick={() => {
                  setSelected(row);
                  setDialogOpen(true);
                }}
                className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm last:border-b-0 hover:bg-muted/30 ${
                  index % 2 === 1 ? "bg-muted/10" : ""
                }`}
              >
                <span className="w-16 shrink-0 text-muted-foreground">
                  {formatTransactionListTime(row.createdAt)}
                </span>
                <span className="min-w-0 flex-1 truncate">{row.productName}</span>
                <span className="w-10 shrink-0 tabular-nums">×{row.quantity}</span>
                <span className="hidden w-28 shrink-0 truncate text-muted-foreground sm:inline">
                  {row.voidedByName}
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums">
                  {formatReportsMoney(row.lineTotal)}
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
      <VoidItemDetailDialog row={selected} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
