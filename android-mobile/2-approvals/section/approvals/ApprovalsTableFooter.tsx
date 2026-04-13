import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatToRupiah } from "@/shared/utils/formatCurrency";

export type ApprovalsTableFooterProps = {
  filteredCount: number;
  totalCount: number;
  /** Jumlah nominal (IDR) untuk baris yang sedang difilter. */
  filteredTotalAmount: number;
};

/**
 * Footer kartu tabel mobile Persetujuan — selaras strip footer `DebtTableSection`
 * (`border-t bg-muted/50`, ringkasan kiri + total kanan).
 */
export function ApprovalsTableFooter({
  filteredCount,
  totalCount,
  filteredTotalAmount,
}: ApprovalsTableFooterProps) {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t bg-muted/50 px-2 py-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {t("approvals.table.showing", "Showing")} {filteredCount} {t("approvals.table.of", "of")} {totalCount}{" "}
          {t("approvals.table.requests", "requests")}
        </span>
        <span className="shrink-0 text-right">
          {t("approvals.table.totalFilteredAmount", "Total (filtered)")}:{" "}
          <span className="font-bold text-red-600">{formatToRupiah(filteredTotalAmount)}</span>
        </span>
      </div>
    </div>
  );
}
