import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import type { AdjustableProduct } from "../hooks/useAdjustableProductsQuery";
import { useAdjustableProductsQuery } from "../hooks/useAdjustableProductsQuery";
import type { AdjustableIngredient } from "../hooks/useAdjustableIngredientsQuery";
import { useAdjustableIngredientsQuery } from "../hooks/useAdjustableIngredientsQuery";
import { useCreateInventoryAdjustment } from "../hooks/useCreateInventoryAdjustment";
import { calcDeltaQty, isNonZeroQty, toInventoryQty } from "../lib/adjustmentFormMath";
import { AdjustmentItemPickerDialog } from "./AdjustmentItemPickerDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { InventoryAdjustmentKindFilter } from "../types";

type DraftLine = {
  itemKind: "product";
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  inStock: number;
  actualStock: number;
} | {
  itemKind: "ingredient";
  ingredientId: string;
  ingredientName: string;
  inStock: number;
  actualStock: number;
};

export function CreateInventoryAdjustmentDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  outletId: string;
  kind: InventoryAdjustmentKindFilter;
}) {
  const { t } = useAppTranslation();
  const [note, setNote] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [step, setStep] = useState<"draft" | "details">("draft");

  const isProductMode = props.kind === "item_library";

  const { data: products = [], isLoading: productsLoading } = useAdjustableProductsQuery({
    organizationId: props.open && isProductMode ? props.organizationId : null,
    outletId: props.open && isProductMode ? props.outletId : null,
  });

  const { data: ingredients = [], isLoading: ingredientsLoading } = useAdjustableIngredientsQuery({
    organizationId: props.open && !isProductMode ? props.organizationId : null,
    outletId: props.open && !isProductMode ? props.outletId : null,
  });

  const existingProductIds = useMemo(
    () => new Set(draftLines.filter((l): l is Extract<DraftLine, { itemKind: "product" }> => l.itemKind === "product").map((l) => l.productId)),
    [draftLines],
  );
  const existingIngredientIds = useMemo(
    () =>
      new Set(
        draftLines
          .filter((l): l is Extract<DraftLine, { itemKind: "ingredient" }> => l.itemKind === "ingredient")
          .map((l) => l.ingredientId),
      ),
    [draftLines],
  );

  const createMutation = useCreateInventoryAdjustment();

  function reset() {
    setNote("");
    setDraftLines([]);
    setPickerOpen(false);
    setStep("draft");
  }

  const onAddProduct = (product: AdjustableProduct) => {
    const hadNoItems = draftLines.length === 0;
    if (existingProductIds.has(product.productId)) return;

    if (hadNoItems) setStep("details");

    if (product.variants.length > 0) {
      const newLines: DraftLine[] = product.variants.map((v) => ({
        itemKind: "product",
        productId: product.productId,
        productName: product.productName,
        variantId: v.variantId,
        variantName: v.variantName,
        inStock: v.inStock,
        actualStock: v.inStock,
      }));
      setDraftLines((prev) => [...prev, ...newLines]);
      return;
    }

    setDraftLines((prev) => [
      ...prev,
      {
        itemKind: "product",
        productId: product.productId,
        productName: product.productName,
        variantId: null,
        variantName: null,
        inStock: product.inStock,
        actualStock: product.inStock,
      },
    ]);
  };

  const onAddIngredient = (ingredient: AdjustableIngredient) => {
    const hadNoItems = draftLines.length === 0;
    if (existingIngredientIds.has(ingredient.ingredientId)) return;

    if (hadNoItems) setStep("details");

    setDraftLines((prev) => [
      ...prev,
      {
        itemKind: "ingredient",
        ingredientId: ingredient.ingredientId,
        ingredientName: ingredient.ingredientName,
        inStock: ingredient.inStock,
        actualStock: ingredient.inStock,
      },
    ]);
  };

  const handleClose = (nextOpen: boolean) => {
    props.onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };

  const groupedDraftLines = useMemo(() => {
    const byProduct = new Map<string, DraftLine[]>();
    for (const line of draftLines) {
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
  }, [draftLines]);

  const totalDeltaQty = useMemo(() => {
    return draftLines.reduce((sum, line) => {
      const delta = calcDeltaQty(line.inStock, line.actualStock);
      return sum + delta;
    }, 0);
  }, [draftLines]);

  const handleCreate = async () => {
    try {
      const lines = draftLines
        .map((line) => {
          const delta = calcDeltaQty(line.inStock, line.actualStock);
          if (line.itemKind === "product") {
            return {
              itemKind: "product" as const,
              productId: line.productId,
              variantId: line.variantId,
              qtyDelta: delta,
            };
          }
          return {
            itemKind: "ingredient" as const,
            ingredientId: line.ingredientId,
            qtyDelta: delta,
          };
        })
        .filter((l) => isNonZeroQty(l.qtyDelta));

      if (!lines.length) {
        toast.message(t("operations.inventory.adjustment.noChanges", "No changes detected."));
        return;
      }

      await createMutation.mutateAsync({
        organizationId: props.organizationId,
        outletId: props.outletId,
        note,
        lines,
      });

      toast.success(t("operations.inventory.adjustment.saved", "Adjustment saved."));
      reset();
      props.onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <Dialog open={props.open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {step === "draft"
                ? t("operations.inventory.adjustment.createTitle", "Create Adjustment")
                : t("operations.inventory.adjustment.itemDetails", "Item Details")}
            </DialogTitle>
          </DialogHeader>

          {step === "draft" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("operations.inventory.adjustment.note", "Note")}</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("common.note", "Notes")}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                  disabled={isProductMode ? productsLoading : ingredientsLoading}
                >
                  {t("operations.inventory.adjustment.addItems", "Add Items")}
                </Button>
                <div className="text-xs text-muted-foreground">
                  {draftLines.length === 0 ? t("operations.inventory.adjustment.itemsEmpty", "No items yet.") : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 border-b pb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {t("operations.inventory.adjustment.colDate", "Date")}
                  </div>
                  <div className="text-sm">{new Date().toLocaleString()}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">{t("operations.inventory.adjustment.colNote", "Note")}</div>
                  <div className="text-sm">{note.trim() || "—"}</div>
                </div>
              </div>

              <div className="min-h-[260px] max-h-[420px] overflow-auto rounded-md border">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="text-sm font-medium">{t("operations.inventory.adjustment.inventoryAdjustment", "INVENTORY ADJUSTMENT")}</div>
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
                    {isProductMode ? (
                      groupedDraftLines.map((group) => (
                        <Fragment key={group.productId}>
                          <TableRow>
                            <TableCell className="font-medium">{group.productName}</TableCell>
                            <TableCell colSpan={3} />
                          </TableRow>
                          {group.lines.map((line) => {
                            const productLine = line as Extract<DraftLine, { itemKind: "product" }>;
                            const delta = calcDeltaQty(productLine.inStock, productLine.actualStock);
                            return (
                              <TableRow key={`${productLine.productId}:${productLine.variantId ?? "none"}`}>
                                <TableCell className="pl-6 text-muted-foreground">
                                  {productLine.variantName ?? productLine.productName}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {toInventoryQty(productLine.inStock)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    step="0.001"
                                    className="w-[160px] text-right tabular-nums"
                                    value={productLine.actualStock}
                                    onChange={(e) => {
                                      const next = toInventoryQty(e.target.value);
                                      setDraftLines((prev) =>
                                        prev.map((p) =>
                                          p.itemKind === "product" &&
                                          p.productId === productLine.productId &&
                                          p.variantId === productLine.variantId
                                            ? { ...p, actualStock: next }
                                            : p,
                                        ),
                                      );
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {toInventoryQty(delta)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </Fragment>
                      ))
                    ) : (
                      <>
                        {draftLines
                          .filter((l): l is Extract<DraftLine, { itemKind: "ingredient" }> => l.itemKind === "ingredient")
                          .map((line) => {
                            const delta = calcDeltaQty(line.inStock, line.actualStock);
                            return (
                              <TableRow key={line.ingredientId}>
                                <TableCell className="font-medium">{line.ingredientName}</TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {toInventoryQty(line.inStock)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    step="0.001"
                                    className="w-[160px] text-right tabular-nums"
                                    value={line.actualStock}
                                    onChange={(e) => {
                                      const next = toInventoryQty(e.target.value);
                                      setDraftLines((prev) =>
                                        prev.map((p) =>
                                          p.itemKind === "ingredient" && p.ingredientId === line.ingredientId
                                            ? { ...p, actualStock: next }
                                            : p,
                                        ),
                                      );
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {toInventoryQty(delta)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </>
                    )}

                    <TableRow>
                      <TableCell className="font-medium">TOTAL</TableCell>
                      <TableCell colSpan={2} />
                      <TableCell className="text-right tabular-nums font-semibold">{toInventoryQty(totalDeltaQty)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={createMutation.isPending}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            {step === "details" ? (
              <Button
                type="button"
                onClick={() => void handleCreate()}
                disabled={createMutation.isPending || draftLines.length === 0}
              >
                {t("operations.inventory.adjustment.done", "Done")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdjustmentItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode={isProductMode ? "product" : "ingredient"}
        products={products}
        ingredients={ingredients}
        existingProductIds={existingProductIds}
        existingIngredientIds={existingIngredientIds}
        onAddProduct={onAddProduct}
        onAddIngredient={onAddIngredient}
      />
    </>
  );
}

