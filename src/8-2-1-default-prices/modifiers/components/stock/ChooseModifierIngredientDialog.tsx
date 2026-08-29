import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { CatalogIngredient } from "@/8-2-3-ingredient/library/types";
import { ingredientInitials } from "@/8-2-3-ingredient/library/lib/ingredientInitials";
import { formatIngredientUnitCode } from "@/8-2-3-ingredient/library/lib/ingredientUnits";

export type ChooseModifierIngredientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: CatalogIngredient[];
  onAdd: (ingredientId: string) => void;
};

type KindFilter = "all" | "raw" | "semi_finished";

export function ChooseModifierIngredientDialog({
  open,
  onOpenChange,
  ingredients,
  onAdd,
}: ChooseModifierIngredientDialogProps) {
  const { t } = useAppTranslation();
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setKindFilter("all");
    setSelectedId(null);
  }, [open]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ingredients.filter((row) => {
      if (row.kind !== "raw" && row.kind !== "semi_finished") return false;
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      if (q && !row.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ingredients, kindFilter, query]);

  const handleAdd = () => {
    if (!selectedId) return;
    onAdd(selectedId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("defaultPrices.modifiers.stockChooseIngredientTitle", "Choose Ingredient")}
          </DialogTitle>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(
                  "defaultPrices.modifiers.stockSearchIngredients",
                  "Search Ingredients",
                )}
                className="pr-9"
              />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Select
              value={kindFilter}
              onValueChange={(v) => setKindFilter(v as KindFilter)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("defaultPrices.modifiers.stockFilterAllTypes", "All Ingredient Type")}
                </SelectItem>
                <SelectItem value="raw">
                  {t("ingredient.library.rawIngredient", "Raw Ingredient")}
                </SelectItem>
                <SelectItem value="semi_finished">
                  {t("ingredient.library.semiFinished", "Semi-Finished Ingredient")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {options.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("defaultPrices.modifiers.stockNoIngredientMatch", "No ingredients available.")}
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatIngredientUnitCode(row.unit_code)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "h-4 w-4 shrink-0 rounded-full border",
                        selectedId === row.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40",
                      )}
                      aria-hidden
                    />
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
            {t("common.add", "Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Compact clear control used on selected ingredient chip. */
export function ModifierStockClearButton({
  onClear,
  label,
}: {
  onClear: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex text-destructive hover:text-destructive/80"
      aria-label={label}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
