import { Receipt } from "lucide-react";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

export type ExpenseTableFooterVariant = "default" | "debt-strip";

export interface ExpenseTableFooterProps {
  totalExpenses: number;
  totalCount: number;
  /** Untuk `debt-strip`: baris terlihat (setelah pencarian). */
  filteredCount?: number;
  variant?: ExpenseTableFooterVariant;
  isLoading?: boolean;
  className?: string;
}

/**
 * Ringkasan bawah tabel pengeluaran.
 * - `default`: desktop / fallback (ikon + ringkas).
 * - `debt-strip`: selaras strip `DebtTableSection` mobile (scroll bersama konten, bukan sticky).
 */
export const ExpenseTableFooter = ({
  totalExpenses,
  totalCount,
  filteredCount,
  variant = "default",
  isLoading = false,
  className,
}: ExpenseTableFooterProps) => {
  const { t } = useAppTranslation();

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-shrink-0 items-center justify-center border-t border-border bg-muted/50 px-2 py-2 text-xs text-muted-foreground",
          className,
        )}
      >
        <span>{t("expenses.tableFooter.loading", "Memuat ringkasan…")}</span>
      </div>
    );
  }

  if (variant === "debt-strip") {
    const shown = filteredCount ?? totalCount;
    return (
      <div className={cn("flex-shrink-0 border-t bg-muted/50 px-2 py-2", className)}>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            {t("expenses.tableFooter.showing", "Showing")} {shown} {t("expenses.tableFooter.of", "of")} {totalCount}{" "}
            {t("expenses.tableFooter.expensesLabel", "expenses")}
          </span>
          <span className="shrink-0 text-right">
            {t("expenses.tableFooter.totalAmountLabel", "Total nominal")}:{" "}
            <span className="font-bold text-red-600">{formatToRupiah(totalExpenses)}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-shrink-0 border-t border-border bg-card px-2 py-2 shadow-[0_-1px_3px_0_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-row items-center justify-between gap-2">
        <div className="flex min-w-0 flex-shrink-0 items-center gap-2">
          <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-xs font-medium text-foreground">
            {t("expenses.tableFooter.totalRecords", "Total")}: {totalCount}
          </span>
        </div>
        <div className="min-w-0 shrink-0 text-right text-xs text-muted-foreground">
          {t("expenses.tableFooter.totalAmountLabel", "Total nominal")}:{" "}
          <span className="font-bold text-red-600">{formatToRupiah(totalExpenses)}</span>
        </div>
      </div>
    </div>
  );
};
