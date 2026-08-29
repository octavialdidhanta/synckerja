import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatRecipeCost, lineAvgCost } from "../../../product-recipes/lib/productRecipeCost";
import { ingredientInitials } from "../../../library/lib/ingredientInitials";
import { formatIngredientStockQty } from "../../../library/lib/ingredientStockStatus";
import { formatIngredientUnitCode } from "../../../library/lib/ingredientUnits";
import { stockForOutlet, type CatalogIngredient } from "../../../library/types";
import type { RecipeDraft } from "../../types";
import { produceBatchCost } from "../lib/produceBatchCost";
import {
  findInsufficientProduceStock,
  scaleRecipeLinesForProduce,
} from "../lib/produceRecipeScale";
import { useProduceIngredientStock } from "../hooks/useProduceIngredientStock";

export type ProduceStockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletId: string;
  output: CatalogIngredient;
  recipe: RecipeDraft;
  ingredientsById: Map<string, CatalogIngredient>;
};

export function ProduceStockDialog({
  open,
  onOpenChange,
  outletId,
  output,
  recipe,
  ingredientsById,
}: ProduceStockDialogProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const produce = useProduceIngredientStock();
  const [produceQty, setProduceQty] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProduceQty("");
    setConfirming(false);
  }, [open]);

  const qtyNumber = Number(produceQty);
  const scaledLines = useMemo(
    () =>
      scaleRecipeLinesForProduce({
        lines: recipe.lines,
        produceQty: Number.isFinite(qtyNumber) ? qtyNumber : 0,
        yieldQty: recipe.yieldQty,
      }),
    [recipe.lines, recipe.yieldQty, qtyNumber],
  );

  const trackInventoryById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const [id, row] of ingredientsById) {
      map.set(id, Boolean(row.track_inventory));
    }
    return map;
  }, [ingredientsById]);

  const stockById = useMemo(() => {
    const map = new Map<string, number>();
    for (const [id, row] of ingredientsById) {
      map.set(id, stockForOutlet(row, outletId).in_stock);
    }
    return map;
  }, [ingredientsById, outletId]);

  const insufficient = useMemo(
    () =>
      findInsufficientProduceStock({
        lines: scaledLines,
        trackInventoryById,
        stockById,
      }),
    [scaledLines, trackInventoryById, stockById],
  );

  const batchCost = useMemo(
    () =>
      produceBatchCost({
        scaledLines,
        ingredientsById,
        outletId,
        produceQty: Number.isFinite(qtyNumber) && qtyNumber > 0 ? qtyNumber : 0,
      }),
    [scaledLines, ingredientsById, outletId, qtyNumber],
  );

  const unitLabel = formatIngredientUnitCode(output.unit_code);
  const canConfirm =
    Number.isFinite(qtyNumber) &&
    qtyNumber > 0 &&
    recipe.yieldQty > 0 &&
    scaledLines.length > 0 &&
    !insufficient &&
    !confirming &&
    !produce.isPending;

  const handleConfirm = async () => {
    if (!canConfirm) {
      if (insufficient) {
        toast({
          title: t(
            "ingredient.produce.insufficient",
            "Not enough raw ingredient stock for this production quantity.",
          ),
          variant: "destructive",
        });
      }
      return;
    }
    setConfirming(true);
    try {
      await produce.mutateAsync({
        outletId,
        outputIngredientId: output.id,
        produceQty: qtyNumber,
      });
      toast({
        title: t("ingredient.produce.success", "Stock produced successfully."),
      });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? "");
      toast({
        title:
          message.includes("catalog_stock_insufficient") || message.includes("23514")
            ? t(
                "ingredient.produce.insufficient",
                "Not enough raw ingredient stock for this production quantity.",
              )
            : t("ingredient.produce.failed", "Could not produce stock."),
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("ingredient.produce.title", "Produce Stock")}
          </DialogTitle>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">
                    {t("ingredient.produce.columnIngredient", "Ingredient")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("ingredient.produce.columnProduce", "Produce")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("ingredient.produce.columnUnit", "Unit")}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-medium uppercase text-muted-foreground">
                        {output.photo_url ? (
                          <img src={output.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          ingredientInitials(output.name) || "—"
                        )}
                      </div>
                      <span className="min-w-0 truncate font-medium">{output.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={produceQty}
                      onChange={(e) => setProduceQty(e.target.value)}
                      className="h-8 w-24"
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{unitLabel}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {qtyNumber > 0 && batchCost.unitCost != null ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                {t("ingredient.produce.avgCostPerUnit", "Avg Cost / {{unit}}", {
                  unit: unitLabel,
                })}
              </span>
              <span className="tabular-nums">{formatRecipeCost(batchCost.unitCost)}</span>
            </div>
          ) : null}

          {scaledLines.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t(
                  "ingredient.produce.deductSection",
                  "Raw Ingredients to Deduct based on recipe",
                )}
              </p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">
                        {t("ingredient.produce.columnIngredient", "Ingredient")}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t("ingredient.produce.columnProduction", "Production")}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t("ingredient.produce.columnUnit", "Unit")}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t("ingredient.produce.columnAvgCost", "Avg Cost")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {scaledLines.map((line) => {
                      const raw = ingredientsById.get(line.ingredientId);
                      const short =
                        insufficient?.ingredientId === line.ingredientId;
                      const lineCost = lineAvgCost(raw, outletId, line.deductQty);
                      return (
                        <tr
                          key={line.ingredientId}
                          className={cn(
                            "border-b last:border-b-0",
                            short && "bg-destructive/10",
                          )}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-medium uppercase text-muted-foreground">
                                {raw?.photo_url ? (
                                  <img
                                    src={raw.photo_url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  ingredientInitials(raw?.name ?? "") || "—"
                                )}
                              </div>
                              <span className="min-w-0 truncate">
                                {raw?.name ?? line.ingredientId}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            −{formatIngredientStockQty(line.deductQty)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {raw ? formatIngredientUnitCode(raw.unit_code) : "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {formatRecipeCost(lineCost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {batchCost.totalCost > 0 ? (
                <div className="flex items-center justify-between border-t pt-2 text-sm font-medium">
                  <span>{t("ingredient.produce.totalAvgCost", "Total Avg Cost")}</span>
                  <span className="tabular-nums">{formatRecipeCost(batchCost.totalCost)}</span>
                </div>
              ) : null}
              {insufficient ? (
                <p className="text-xs text-destructive">
                  {t(
                    "ingredient.produce.insufficient",
                    "Not enough raw ingredient stock for this production quantity.",
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter className="flex flex-row items-center justify-end gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:space-x-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={!canConfirm}>
            {t("common.confirm", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
