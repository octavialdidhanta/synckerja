import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogIngredients } from "../../library/hooks/useCatalogIngredients";
import { isProductRecipeDraftComplete } from "../lib/productRecipeCompleteness";
import { formatRecipeCost, totalAvgCost } from "../lib/productRecipeCost";
import { ingredientsForOutlet, variantOptionsForProduct } from "../lib/productRecipeTargets";
import type { CatalogProductRecipe, ProductRecipeDraft, ProductRecipeTargetProduct } from "../types";
import { emptyProductRecipeDraft, productRecipeKey } from "../types";
import { AddRecipeIngredientDialog } from "./AddRecipeIngredientDialog";
import { ProductItemSelect } from "./ProductItemSelect";
import { ProductRecipeLinesTable } from "./ProductRecipeLinesTable";
import { VariantOptionSelect } from "./VariantOptionSelect";

export type ProductRecipeFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOutletId: string;
  products: ProductRecipeTargetProduct[];
  modifierLinks: Array<{ product_id: string; group_id: string; group_name: string }>;
  modifierOptions: Array<{ id: string; group_id: string; group_name: string; name: string; is_active?: boolean }>;
  recipesByKey: Map<string, CatalogProductRecipe>;
  initialProductId?: string;
  initialModifierOptionId?: string | null;
  onSave: (payload: {
    productId: string;
    modifierOptionId: string | null;
    lines: ProductRecipeDraft["lines"];
  }) => Promise<void>;
  isSaving: boolean;
};

export function ProductRecipeFormSheet({
  open,
  onOpenChange,
  selectedOutletId,
  products,
  modifierLinks,
  modifierOptions,
  recipesByKey,
  initialProductId = "",
  initialModifierOptionId = null,
  onSave,
  isSaving,
}: ProductRecipeFormSheetProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows: ingredientRows } = useCatalogIngredients();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [modifierOptionId, setModifierOptionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductRecipeDraft>(emptyProductRecipeDraft());
  const [addOpen, setAddOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  const outletProducts = useMemo(
    () => products.filter((row) => (row.outlet_ids ?? []).includes(selectedOutletId)),
    [products, selectedOutletId],
  );

  const variantOptions = useMemo(
    () =>
      selectedProductId
        ? variantOptionsForProduct(
            selectedProductId,
            modifierLinks,
            modifierOptions.map((row) => ({
              id: row.id,
              group_id: row.group_id,
              name: row.name,
              is_active: row.is_active ?? true,
            })),
          )
        : [],
    [modifierLinks, modifierOptions, selectedProductId],
  );

  const outletIngredients = useMemo(
    () => ingredientsForOutlet(ingredientRows, selectedOutletId),
    [ingredientRows, selectedOutletId],
  );

  const ingredientsById = useMemo(() => {
    const map = new Map(ingredientRows.map((row) => [row.id, row]));
    return map;
  }, [ingredientRows]);

  useEffect(() => {
    if (!open) return;
    setSelectedProductId(initialProductId);
    setModifierOptionId(initialModifierOptionId ?? null);
    setAddOpen(false);
    setDirty(false);
  }, [open, initialProductId, initialModifierOptionId]);

  useEffect(() => {
    if (!open || !selectedProductId) {
      setDraft(emptyProductRecipeDraft());
      return;
    }
    const existing = recipesByKey.get(productRecipeKey(selectedProductId, modifierOptionId));
    setDraft(
      existing
        ? {
            lines: existing.lines.map((line) => ({
              ingredient_id: line.ingredient_id,
              quantity: line.quantity,
            })),
          }
        : emptyProductRecipeDraft(),
    );
    setDirty(false);
  }, [open, selectedProductId, modifierOptionId, recipesByKey]);

  const excludeIds = useMemo(() => draft.lines.map((line) => line.ingredient_id), [draft.lines]);
  const totalCost = totalAvgCost(draft.lines, ingredientsById, selectedOutletId);
  const isEdit = Boolean(
    selectedProductId &&
      recipesByKey.get(productRecipeKey(selectedProductId, modifierOptionId)),
  );

  const handleSave = async () => {
    if (!selectedProductId) {
      toast({
        title: t("ingredient.productRecipe.itemRequired", "Select an item first."),
        variant: "destructive",
      });
      return;
    }
    if (!isProductRecipeDraftComplete(draft)) {
      toast({
        title: t(
          "ingredient.productRecipe.incomplete",
          "Add at least one ingredient with a quantity greater than zero.",
        ),
        variant: "destructive",
      });
      return;
    }
    try {
      await onSave({
        productId: selectedProductId,
        modifierOptionId,
        lines: draft.lines,
      });
      toast({ title: t("ingredient.productRecipe.saved", "Recipe saved.") });
      onOpenChange(false);
    } catch {
      toast({
        title: t("ingredient.productRecipe.saveFailed", "Could not save recipe."),
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    if (!selectedProductId) {
      setDraft(emptyProductRecipeDraft());
      setDirty(false);
      return;
    }
    const existing = recipesByKey.get(productRecipeKey(selectedProductId, modifierOptionId));
    setDraft(
      existing
        ? {
            lines: existing.lines.map((line) => ({
              ingredient_id: line.ingredient_id,
              quantity: line.quantity,
            })),
          }
        : emptyProductRecipeDraft(),
    );
    setDirty(false);
  };

  const title = isEdit
    ? t("ingredient.productRecipe.editTitle", "Edit Recipe")
    : t("ingredient.productRecipe.createTitle", "Create Recipe");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <section className="space-y-2">
            <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("ingredient.productRecipe.chooseItem", "Choose Item")}
            </p>
            <ProductItemSelect
              products={outletProducts}
              value={selectedProductId}
              onChange={(next) => {
                setSelectedProductId(next);
                setModifierOptionId(null);
                setDirty(true);
              }}
            />
          </section>

          {selectedProductId ? (
            <section className="space-y-2">
              <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("ingredient.productRecipe.chooseVariant", "Choose Variant")}
              </p>
              {variantOptions.length > 0 ? (
                <VariantOptionSelect
                  options={variantOptions}
                  value={modifierOptionId}
                  onChange={(next) => {
                    setModifierOptionId(next);
                    setDirty(true);
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "ingredient.productRecipe.noVariants",
                    "This product has no modifier variants. Recipe applies to the base item.",
                  )}
                </p>
              )}
            </section>
          ) : null}

          {selectedProductId ? (
            <section className="space-y-3">
              <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("ingredient.productRecipe.recipeSection", "Recipe")}
              </p>
              <Button type="button" className="w-full" onClick={() => setAddOpen(true)}>
                {t("ingredient.productRecipe.addIngredient", "Add Ingredient")}
              </Button>
              {draft.lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("ingredient.productRecipe.noLines", "No ingredients added yet.")}
                </p>
              ) : (
                <>
                  <ProductRecipeLinesTable
                    lines={draft.lines}
                    selectedOutletId={selectedOutletId}
                    onChange={(lines) => {
                      setDraft({ lines });
                      setDirty(true);
                    }}
                  />
                  <div className="flex items-center justify-between border-t pt-3 text-sm font-medium">
                    <span>{t("ingredient.productRecipe.totalAvgCost", "Total Avg Cost")}</span>
                    <span>{formatRecipeCost(totalCost)}</span>
                  </div>
                </>
              )}
            </section>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={!dirty || isSaving}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {t("common.save", "Save")}
          </Button>
        </div>
      </SheetContent>
      <AddRecipeIngredientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        ingredients={outletIngredients}
        excludeIds={excludeIds}
        onAdd={(ingredientId) => {
          setDraft((prev) =>
            prev.lines.some((line) => line.ingredient_id === ingredientId)
              ? prev
              : { lines: [...prev.lines, { ingredient_id: ingredientId, quantity: 0 }] },
          );
          setDirty(true);
        }}
      />
    </Sheet>
  );
}
