import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { StockTransferLineDraft } from "../types";

export type TransferQtyRow = {
  key: string;
  label: string;
  unit?: string;
  inStock: number;
  qty: number;
  productId?: string;
  variantId?: string | null;
  ingredientId?: string;
};

export function TransferEnterQtyDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  rows: TransferQtyRow[];
  onConfirm: (lines: StockTransferLineDraft[]) => void;
}) {
  const { t } = useAppTranslation();
  const [draftRows, setDraftRows] = useState<TransferQtyRow[]>([]);

  useEffect(() => {
    if (props.open) setDraftRows(props.rows.map((row) => ({ ...row })));
  }, [props.open, props.rows]);

  const canAdd = draftRows.some((row) => row.qty > 0 && row.qty <= row.inStock);

  const handleConfirm = () => {
    const lines: StockTransferLineDraft[] = draftRows
      .filter((row) => row.qty > 0 && row.qty <= row.inStock)
      .map((row) => ({
        productId: row.productId,
        variantId: row.variantId,
        ingredientId: row.ingredientId,
        nameSnapshot: row.label,
        qty: row.qty,
        inStock: row.inStock,
        unitSnapshot: row.unit,
      }));
    if (lines.length === 0) return;
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
                <TableHead>{t("operations.inventory.transfer.colName", "Name")}</TableHead>
                <TableHead>{t("operations.inventory.transfer.colUnit", "Unit")}</TableHead>
                <TableHead className="text-right">{t("operations.inventory.transfer.inStock", "In Stock")}</TableHead>
                <TableHead className="text-right">
                  {t("operations.inventory.transfer.transferQty", "Transfer Quantity")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftRows.map((row) => {
                const over = row.qty > row.inStock;
                return (
                  <TableRow key={row.key}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-muted-foreground">{row.unit?.trim() || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.inStock}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={row.inStock}
                        className="ml-auto h-8 w-28 text-right"
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
                      {over ? (
                        <p className="mt-1 text-xs text-destructive">
                          {t("operations.inventory.transfer.qtyExceedsStock", "Cannot exceed in-stock quantity.")}
                        </p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canAdd}>
            {t("operations.inventory.transfer.add", "Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
