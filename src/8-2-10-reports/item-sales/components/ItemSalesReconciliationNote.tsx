import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { ItemSalesDisplay } from "../lib/itemSalesTypes";

type Props = {
  display: ItemSalesDisplay;
  variant: "income" | "quantity";
};

export function ItemSalesReconciliationNote({ display, variant }: Props) {
  const { t } = useAppTranslation();

  if (variant === "quantity") {
    return (
      <p className="border-t border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        {t(
          "reports.itemSales.quantityFootnote",
          "Item Refunded ({count} total in period) counts full refunds by refund date and does not reduce Quantity Sold.",
          { count: display.totals.qtyRefunded },
        )}
      </p>
    );
  }

  if (display.reconciliationOk) {
    return (
      <p className="border-t border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        {t(
          "reports.itemSales.reconciliationOk",
          "Σ Net Sales (items) matches product net sales for this period.",
        )}
      </p>
    );
  }

  return (
    <p className="border-t border-border bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      {t(
        "reports.itemSales.reconciliationMismatch",
        "Σ Net Sales (items) ({total}) differs from product net ({summary}). Check unlinked or bundle rows.",
        {
          total: display.totals.netSales.toLocaleString("id-ID"),
          summary: display.summaryProductNetSales.toLocaleString("id-ID"),
        },
      )}
    </p>
  );
}
