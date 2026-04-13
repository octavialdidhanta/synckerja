import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatToRupiah } from "@/shared/utils/formatCurrency";

export type PaymentTableFooterProps = {
  /** Baris approved yang tampil setelah filter. */
  shownApprovedCount: number;
  /** Total permintaan approved di organisasi (sebelum filter tampilan tabel). */
  totalApprovedCount: number;
  /** Jumlah nominal IDR untuk baris approved yang sedang ditampilkan. */
  filteredTotalAmount: number;
};

/**
 * Footer kartu tabel mobile Payment — selaras `ApprovalsTableFooter` / `DebtTableSection`.
 */
export function PaymentTableFooter({
  shownApprovedCount,
  totalApprovedCount,
  filteredTotalAmount,
}: PaymentTableFooterProps) {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t bg-muted/50 px-2 py-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {t("payments.table.showing", "Showing")} {shownApprovedCount} {t("payments.table.of", "of")}{" "}
          {totalApprovedCount} {t("payments.table.approvedLabel", "approved")}
        </span>
        <span className="shrink-0 text-right">
          {t("payments.table.totalFilteredAmount", "Total (filtered)")}:{" "}
          <span className="font-bold text-red-600">{formatToRupiah(filteredTotalAmount)}</span>
        </span>
      </div>
    </div>
  );
}
