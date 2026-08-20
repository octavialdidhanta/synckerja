import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { InventorySummaryLine } from "../types";

function formatQty(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value);
}

export type InventorySummaryTableProps = {
  lines: InventorySummaryLine[];
};

export function InventorySummaryTable({ lines }: InventorySummaryTableProps) {
  const { t } = useAppTranslation();

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40">
          <TableHead>{t("operations.inventory.summary.colName", "Name - Variant")}</TableHead>
          <TableHead>{t("operations.inventory.summary.colCategory", "Category")}</TableHead>
          <TableHead className="text-right">{t("operations.inventory.summary.colBeginning", "Beginning")}</TableHead>
          <TableHead className="text-right">{t("operations.inventory.summary.colPo", "Purchase Order")}</TableHead>
          <TableHead className="text-right">{t("operations.inventory.summary.colSales", "Sales")}</TableHead>
          <TableHead className="text-right">{t("operations.inventory.summary.colTransfer", "Transfer")}</TableHead>
          <TableHead className="text-right">{t("operations.inventory.summary.colAdjustment", "Adjustment")}</TableHead>
          <TableHead className="text-right">{t("operations.inventory.summary.colEnding", "Ending")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
              <p>{t("operations.inventory.summary.empty", "No tracked items for this outlet.")}</p>
              <p className="mt-2 text-xs">
                {t(
                  "operations.inventory.summary.emptyHint",
                  "Tracked products without variants appear as one row. Enable Track stock and assign an outlet in Item Library, or migrate legacy SKU stock.",
                )}
              </p>
            </TableCell>
          </TableRow>
        ) : (
          lines.map((row) => (
            <TableRow key={`${row.itemKind}-${row.productId ?? row.ingredientId}-${row.variantId ?? "base"}`}>
              <TableCell className={row.variantId ? "pl-8 text-sm" : "font-medium"}>
                {row.variantId ? row.variantName : row.name}
              </TableCell>
              <TableCell className="text-sm">{row.isParent || !row.variantId ? row.categoryName || "—" : ""}</TableCell>
              <TableCell className="text-right tabular-nums">{row.isParent ? "" : formatQty(row.beginning)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.isParent ? "" : formatQty(row.purchaseOrder)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.isParent ? "" : formatQty(row.sales)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.isParent ? "" : formatQty(row.transfer)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.isParent ? "" : formatQty(row.adjustment)}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {row.isParent ? "" : formatQty(row.ending)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
