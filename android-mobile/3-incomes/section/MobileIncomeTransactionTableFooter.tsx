import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatToRupiah } from "@/shared/utils/formatCurrency";

export type MobileIncomeTransactionTableFooterProps = {
  filteredCount: number;
  totalCount: number;
  totalAmount: number;
  /** Teks tambahan di sisi kiri (mis. ` · TypeName` saat filter tipe aktif). */
  extraHint?: string;
};

/**
 * Footer kartu daftar transaksi mobile — selaras strip `ApprovalsTableFooter` / expense tabs.
 */
export function MobileIncomeTransactionTableFooter({
  filteredCount,
  totalCount,
  totalAmount,
  extraHint,
}: MobileIncomeTransactionTableFooterProps) {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-2 py-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {t("incomes.transactionTable.showing", "Showing")} {filteredCount} {t("incomes.transactionTable.of", "of")}{" "}
          {totalCount} {t("incomes.transactionTable.transactions", "transactions")}
          {extraHint ?? ""}
        </span>
        <span className="shrink-0 text-right">
          {t("incomes.transactionTable.totalFiltered", "Total (filtered)")}:{" "}
          <span className="font-bold text-red-600">{formatToRupiah(totalAmount)}</span>
        </span>
      </div>
    </div>
  );
}
