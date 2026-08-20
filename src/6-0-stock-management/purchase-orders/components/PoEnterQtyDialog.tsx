import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { calcLineSubtotal } from "../lib/poFormMath";
import type { PurchaseOrderLineDraft } from "../types";

type QtyRow = {
  key: string;
  label: string;
  inStock: number;
  qty: number;
  unitCost: number;
  productId?: string;
  variantId?: string | null;
  ingredientId?: string;
};

export function PoEnterQtyDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  rows: QtyRow[];
  onConfirm: (lines: PurchaseOrderLineDraft[]) => void;
}) {
  const { t } = useAppTranslation();
  const [draftRows, setDraftRows] = useState<QtyRow[]>([]);

  useEffect(() => {
    if (props.open) setDraftRows(props.rows.map((row) => ({ ...row })));
  }, [props.open, props.rows]);

  const total = useMemo(
    () => draftRows.reduce((sum, row) => sum + calcLineSubtotal(row.qty, row.unitCost), 0),
    [draftRows],
  );

  const handleConfirm = () => {
    const lines: PurchaseOrderLineDraft[] = draftRows
      .filter((row) => row.qty > 0)
      .map((row) => ({
        productId: row.productId,
        variantId: row.variantId,
        ingredientId: row.ingredientId,
        nameSnapshot: row.label,
        qty: row.qty,
        unitCost: row.unitCost,
        inStock: row.inStock,
      }));
    props.onConfirm(lines);
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
        </DialogHeader>

        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("operations.inventory.purchaseOrders.colName", "Name")}</TableHead>
                <TableHead className="text-right">{t("operations.inventory.purchaseOrders.inStock", "In Stock")}</TableHead>
                <TableHead className="text-right">{t("operations.inventory.purchaseOrders.qty", "Qty")}</TableHead>
                <TableHead className="text-right">{t("operations.inventory.purchaseOrders.unitCost", "Unit Cost")}</TableHead>
                <TableHead className="text-right">{t("operations.inventory.purchaseOrders.subtotal", "Subtotal")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.inStock}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      className="ml-auto h-8 w-24 text-right"
                      value={row.qty || ""}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        setDraftRows((prev) =>
                          prev.map((item) =>
                            item.key === row.key ? { ...item, qty: Number.isFinite(qty) ? qty : 0 } : item,
                          ),
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      className="ml-auto h-8 w-28 text-right"
                      value={row.unitCost || ""}
                      onChange={(e) => {
                        const unitCost = Number(e.target.value);
                        setDraftRows((prev) =>
                          prev.map((item) =>
                            item.key === row.key
                              ? { ...item, unitCost: Number.isFinite(unitCost) ? unitCost : 0 }
                              : item,
                          ),
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatToRupiah(calcLineSubtotal(row.qty, row.unitCost))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end text-sm font-semibold">
          {t("operations.inventory.purchaseOrders.total", "Total")}: {formatToRupiah(total)}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={handleConfirm}>
            {t("operations.inventory.purchaseOrders.add", "Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { QtyRow };
