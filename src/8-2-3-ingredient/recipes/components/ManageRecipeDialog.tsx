import { useEffect, useMemo, useState } from "react";
import { Info, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ingredientInitials } from "../../library/lib/ingredientInitials";
import { formatIngredientStockQty } from "../../library/lib/ingredientStockStatus";
import { formatIngredientUnitCode } from "../../library/lib/ingredientUnits";
import { useCatalogIngredients } from "../../library/hooks/useCatalogIngredients";
import type { CatalogIngredient } from "../../library/types";
import {
  formatRecipeCost,
  lineAvgCost,
  recipeUnitAvgCost,
  totalAvgCost,
} from "../../product-recipes/lib/productRecipeCost";
import { isRecipeComplete } from "../lib/recipeCompleteness";
import type { RecipeDraft } from "../types";
import { AddRawIngredientDialog } from "./AddRawIngredientDialog";

export type ManageRecipeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outputName: string;
  unitCode: string;
  outputIngredientId?: string;
  selectedOutletId: string;
  draft: RecipeDraft;
  onSave: (draft: RecipeDraft) => Promise<void> | void;
};

export function ManageRecipeDialog({
  open,
  onOpenChange,
  outputName,
  unitCode,
  outputIngredientId,
  selectedOutletId,
  draft,
  onSave,
}: ManageRecipeDialogProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows } = useCatalogIngredients();
  const [yieldQty, setYieldQty] = useState("");
  const [lines, setLines] = useState(draft.lines);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setYieldQty(draft.yieldQty ? formatIngredientStockQty(draft.yieldQty) : "0");
    setLines(draft.lines.map((line) => ({ ...line })));
    setAddOpen(false);
  }, [open, draft]);

  const ingredientsById = useMemo(() => {
    const map = new Map<string, CatalogIngredient>();
    for (const row of rows) map.set(row.id, row);
    return map;
  }, [rows]);

  const excludeIds = useMemo(() => {
    const ids = lines.map((line) => line.ingredient_id);
    if (outputIngredientId) ids.push(outputIngredientId);
    return ids;
  }, [lines, outputIngredientId]);

  const totalCost = useMemo(
    () => totalAvgCost(lines, ingredientsById, selectedOutletId),
    [lines, ingredientsById, selectedOutletId],
  );

  const yieldQtyNumber = Number(yieldQty);
  const avgCostPerUnit = recipeUnitAvgCost(lines, yieldQtyNumber, ingredientsById, selectedOutletId);

  const handleSave = async () => {
    const qty = Number(yieldQty);
    if (!isRecipeComplete(qty, lines)) {
      toast({
        title: t(
          "ingredient.recipe.incomplete",
          "Enter a production quantity and at least one raw ingredient quantity.",
        ),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await onSave({ yieldQty: qty, lines });
      onOpenChange(false);
    } catch {
      toast({
        title: t("ingredient.recipe.saveFailed", "Could not save recipe."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const unitLabel = formatIngredientUnitCode(unitCode);
  const name = outputName.trim() || "—";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setAddOpen(false);
          onOpenChange(next);
        }}
      >
        <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <div className="bg-primary px-4 py-3">
            <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
              {t("ingredient.recipe.manageTitle", "Manage Recipe")}
            </DialogTitle>
          </div>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
            <div className="space-y-1.5">
              <Label>{t("ingredient.recipe.recipeFor", "Recipe for")}</Label>
              <Input value={name} readOnly disabled />
            </div>
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {t("ingredient.recipe.yieldLabel", "This recipe is to create")}
                <Info className="h-3.5 w-3.5 text-primary" />
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={yieldQty}
                  onChange={(e) => setYieldQty(e.target.value)}
                  className="h-9 w-24"
                  inputMode="decimal"
                />
                <span className="text-sm text-muted-foreground">
                  {t("ingredient.recipe.yieldUnitOf", "{{unit}} of {{name}}", {
                    unit: unitLabel,
                    name,
                  })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "ingredient.recipe.yieldHint",
                  "This will be used as calculation to deduct raw ingredient.",
                )}
              </p>
              {avgCostPerUnit != null ? (
                <p className="text-sm font-medium text-foreground">
                  {t("ingredient.recipe.avgCostPerUnit", "Avg Cost / {{unit}}", {
                    unit: unitLabel,
                  })}
                  <span className="ml-2 tabular-nums">{formatRecipeCost(avgCostPerUnit)}</span>
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("ingredient.recipe.needed", "Ingredients Needed")}</p>
              <Button type="button" className="w-full" onClick={() => setAddOpen(true)}>
                {t("ingredient.recipe.addRaw", "Add Raw Ingredient")}
              </Button>
              {lines.length === 0 ? null : (
                <>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">
                            {t("ingredient.recipe.columnIngredient", "Ingredient")}
                          </th>
                          <th className="px-3 py-2 font-medium">
                            {t("ingredient.recipe.columnQuantity", "Quantity")}
                          </th>
                          <th className="px-3 py-2 font-medium">
                            {t("ingredient.recipe.columnUnit", "Unit")}
                          </th>
                          <th className="px-3 py-2 font-medium">
                            {t("ingredient.recipe.columnAvgCost", "Avg Cost")}
                          </th>
                          <th className="w-10 px-2 py-2" aria-hidden />
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => {
                          const ingredient = ingredientsById.get(line.ingredient_id);
                          const lineCost = lineAvgCost(
                            ingredient,
                            selectedOutletId,
                            line.quantity,
                          );
                          return (
                            <tr key={line.ingredient_id} className="border-b last:border-b-0">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-medium uppercase text-muted-foreground">
                                    {ingredient?.photo_url ? (
                                      <img
                                        src={ingredient.photo_url}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      ingredientInitials(ingredient?.name ?? "") || "—"
                                    )}
                                  </div>
                                  <span className="min-w-0 truncate">
                                    {ingredient?.name ?? line.ingredient_id}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  value={
                                    line.quantity ? formatIngredientStockQty(line.quantity) : ""
                                  }
                                  onChange={(e) => {
                                    const next = Number(e.target.value);
                                    setLines((prev) =>
                                      prev.map((item) =>
                                        item.ingredient_id === line.ingredient_id
                                          ? {
                                              ...item,
                                              quantity:
                                                Number.isFinite(next) && next >= 0 ? next : 0,
                                            }
                                          : item,
                                      ),
                                    );
                                  }}
                                  className="h-8 w-24"
                                  inputMode="decimal"
                                />
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {ingredient
                                  ? formatIngredientUnitCode(ingredient.unit_code)
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {formatRecipeCost(lineCost)}
                              </td>
                              <td className="px-2 py-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() =>
                                    setLines((prev) =>
                                      prev.filter(
                                        (item) => item.ingredient_id !== line.ingredient_id,
                                      ),
                                    )
                                  }
                                  aria-label={t("common.delete", "Delete")}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-1.5 border-t pt-3 text-sm font-medium">
                    <div className="flex items-center justify-between">
                      <span>{t("ingredient.recipe.totalAvgCost", "Total Avg Cost")}</span>
                      <span className="tabular-nums">
                        {formatRecipeCost(totalCost > 0 ? totalCost : null)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>
                        {t("ingredient.recipe.avgCostPerUnit", "Avg Cost / {{unit}}", {
                          unit: unitLabel,
                        })}
                      </span>
                      <span className="tabular-nums text-foreground">
                        {formatRecipeCost(avgCostPerUnit)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-row items-center justify-end gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {t("common.save", "Save")}
            </Button>
          </DialogFooter>
          <AddRawIngredientDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            ingredients={rows}
            excludeIds={excludeIds}
            selectedOutletId={selectedOutletId}
            onAdd={(ingredientId) => {
              setLines((prev) =>
                prev.some((line) => line.ingredient_id === ingredientId)
                  ? prev
                  : [...prev, { ingredient_id: ingredientId, quantity: 0 }],
              );
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
