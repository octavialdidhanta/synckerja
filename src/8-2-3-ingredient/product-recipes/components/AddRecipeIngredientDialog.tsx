import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { CatalogIngredient } from "../../library/types";
import { ingredientInitials } from "../../library/lib/ingredientInitials";

export type AddRecipeIngredientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: CatalogIngredient[];
  excludeIds: string[];
  onAdd: (ingredientId: string) => void;
};

export function AddRecipeIngredientDialog({
  open,
  onOpenChange,
  ingredients,
  excludeIds,
  onAdd,
}: AddRecipeIngredientDialogProps) {
  const { t } = useAppTranslation();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedId(null);
  }, [open]);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ingredients.filter((row) => {
      if (row.kind !== "raw" && row.kind !== "semi_finished") return false;
      if (excluded.has(row.id)) return false;
      if (q && !row.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [excluded, ingredients, query]);

  const handleAdd = () => {
    if (!selectedId) return;
    onAdd(selectedId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="relative bg-primary px-10 py-3">
          <button
            type="button"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-foreground"
            onClick={() => onOpenChange(false)}
            aria-label={t("common.back", "Back")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("ingredient.productRecipe.addIngredientTitle", "Add Ingredient")}
          </DialogTitle>
        </div>
        <div className="space-y-3 p-4">
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ingredient.productRecipe.searchIngredients", "Search Ingredients")}
              className="pr-9"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          {options.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("ingredient.productRecipe.noIngredientMatch", "No ingredients available.")}
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {options.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-left hover:bg-muted/60",
                      selectedId === row.id && "bg-muted",
                    )}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium uppercase text-muted-foreground">
                      {row.photo_url ? (
                        <img src={row.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        ingredientInitials(row.name) || "—"
                      )}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {row.kind === "semi_finished"
                        ? t("ingredient.library.semiFinished", "Semi-Finished Ingredient")
                        : t("ingredient.library.rawIngredient", "Raw Ingredient")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="flex flex-row items-center justify-end gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:space-x-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={handleAdd} disabled={!selectedId}>
            {t("ingredient.productRecipe.add", "Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
