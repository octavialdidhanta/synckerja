import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatToRupiah } from "@/shared/utils/formatCurrency";

export type BillsTableFooterProps = {
  filteredCount: number;
  totalCount: number;
  filteredTotalAmount: number;
};

/**
 * Footer kartu tabel mobile Tagihan — selaras `ApprovalsTableFooter` / `PaymentTableFooter`.
 */
export function BillsTableFooter({ filteredCount, totalCount, filteredTotalAmount }: BillsTableFooterProps) {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t bg-muted/50 px-2 py-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {t("reminderBills.table.showing", "Showing")} {filteredCount} {t("reminderBills.table.of", "of")} {totalCount}{" "}
          {t("reminderBills.table.bills", "bills")}
        </span>
        <span className="shrink-0 text-right">
          {t("reminderBills.table.totalFilteredAmount", "Total (filtered)")}:{" "}
          <span className="font-bold text-red-600">{formatToRupiah(filteredTotalAmount)}</span>
        </span>
      </div>
    </div>
  );
}
