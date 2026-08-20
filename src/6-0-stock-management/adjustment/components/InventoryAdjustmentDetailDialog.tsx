import { Fragment, useMemo } from "react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { toInventoryQty } from "../lib/adjustmentFormMath";
import type { InventoryAdjustmentBatch, InventoryAdjustmentIngredientLine, InventoryAdjustmentProductLine } from "../types";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function InventoryAdjustmentDetailDialog(props: {
  batch: InventoryAdjustmentBatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useAppTranslation();
  const batch = props.batch;

  const groupedLines = useMemo(() => {
    if (!batch) return [];
    if (batch.itemKind === "ingredient") return [];

    const byProduct = new Map<string, InventoryAdjustmentProductLine[]>();
    for (const line of batch.lines) {
      if (line.itemKind !== "product") continue;
      const existing = byProduct.get(line.productId);
      if (existing) existing.push(line);
      else byProduct.set(line.productId, [line]);
    }
    return [...byProduct.entries()].map(([productId, lines]) => ({
      productId,
      productName: lines[0]?.productName ?? "",
      lines,
    }));
  }, [batch]);

  if (!batch) return null;
  const isIngredient = batch.itemKind === "ingredient";

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("operations.inventory.adjustment.itemDetails", "Item Details")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 border-b pb-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{t("operations.inventory.adjustment.colDate", "Date")}</div>
              <div className="text-sm">{new Date(batch.occurredAt).toLocaleString()}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{t("operations.inventory.adjustment.colNote", "Note")}</div>
              <div className="text-sm">{batch.note?.trim() || "—"}</div>
            </div>
          </div>

          <div className="overflow-auto rounded-md border">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-medium">
                {t("operations.inventory.adjustment.inventoryAdjustment", "INVENTORY ADJUSTMENT")}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">{t("operations.inventory.adjustment.colItem", "Item")}</TableHead>
                  <TableHead className="text-right">{t("operations.inventory.adjustment.colInStock", "In Stock")}</TableHead>
                  <TableHead className="text-right">{t("operations.inventory.adjustment.colActualStock", "Actual Stock")}</TableHead>
                  <TableHead className="text-right">{t("operations.inventory.adjustment.colAdjustment", "Adjustment")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isIngredient ? (
                  <>
                    {batch.lines
                      .filter((l): l is InventoryAdjustmentIngredientLine => l.itemKind === "ingredient")
                      .map((line) => (
                        <TableRow key={line.ingredientId}>
                          <TableCell className="font-medium">{line.ingredientName}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {toInventoryQty(line.inStock)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{toInventoryQty(line.actualStock)}</TableCell>
                          <TableCell className="text-right tabular-nums">{toInventoryQty(line.qtyDelta)}</TableCell>
                        </TableRow>
                      ))}
                  </>
                ) : (
                  groupedLines.map((group) => (
                    <Fragment key={group.productId}>
                      <TableRow>
                        <TableCell className="font-medium">{group.productName}</TableCell>
                        <TableCell colSpan={3} />
                      </TableRow>
                      {group.lines.map((line) => {
                        return (
                          <TableRow key={`${line.productId}:${line.variantId ?? "none"}`}>
                            <TableCell className="pl-6 text-muted-foreground">
                              {line.variantName ?? line.productName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {toInventoryQty(line.inStock)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {toInventoryQty(line.actualStock)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {toInventoryQty(line.qtyDelta)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  ))
                )}
                <TableRow>
                  <TableCell className="font-medium">TOTAL</TableCell>
                  <TableCell colSpan={2} />
                  <TableCell className="text-right tabular-nums font-semibold">
                    {toInventoryQty(batch.totalQtyDelta)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => props.onOpenChange(false)}>
            {t("operations.inventory.adjustment.done", "Done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
