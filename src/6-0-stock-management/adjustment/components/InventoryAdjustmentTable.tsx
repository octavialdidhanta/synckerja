import { useState } from "react";
import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import type { InventoryAdjustmentBatch } from "../types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { InventoryAdjustmentDetailDialog } from "./InventoryAdjustmentDetailDialog";
import type { InventoryAdjustmentKindFilter } from "../types";

export function InventoryAdjustmentTable({
  batches,
  kind,
}: {
  batches: InventoryAdjustmentBatch[];
  kind: InventoryAdjustmentKindFilter;
}) {
  const { t } = useTranslation();
  const [detailBatch, setDetailBatch] = useState<InventoryAdjustmentBatch | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (batch: InventoryAdjustmentBatch) => {
    setDetailBatch(batch);
    setDetailOpen(true);
  };

  if (batches.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-6 text-sm text-muted-foreground">
        {kind === "ingredients"
          ? t("operations.inventory.adjustment.emptyIngredients", "No ingredient adjustments yet for this outlet.")
          : t("operations.inventory.adjustment.empty", "No adjustments yet for this outlet.")}
      </div>
    );
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("operations.inventory.adjustment.colDate", "Date")}</TableHead>
              <TableHead>{t("operations.inventory.adjustment.colNote", "Note")}</TableHead>
              <TableHead>{t("operations.inventory.adjustment.colItems", "Items")}</TableHead>
              <TableHead className="text-right">
                {t("operations.inventory.adjustment.colAdjustment", "Adjustment")}
              </TableHead>
              <TableHead className="text-right">
                {t("operations.inventory.adjustment.colExpenseIncome", "Expense/Income")}
              </TableHead>
              <TableHead className="text-right w-[100px]">
                {t("operations.inventory.adjustment.colAction", "Action")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => (
              <TableRow key={batch.referenceId}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(batch.occurredAt).toLocaleString()}
                </TableCell>
                <TableCell>{batch.note ?? "—"}</TableCell>
                <TableCell className="max-w-[320px] truncate">{batch.itemsLabel}</TableCell>
                <TableCell className="text-right tabular-nums">{batch.totalQtyDelta}</TableCell>
                <TableCell className="text-right tabular-nums">Rp 0</TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => openDetail(batch)}
                    aria-label={t("operations.inventory.adjustment.viewDetail", "View detail")}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InventoryAdjustmentDetailDialog
        batch={detailBatch}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailBatch(null);
        }}
      />
    </>
  );
}
