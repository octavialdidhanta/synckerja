import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogIngredients } from "../../library/hooks/useCatalogIngredients";
import { ingredientInitials } from "../../library/lib/ingredientInitials";
import { ingredientCategoryMembershipDiff } from "../lib/ingredientCategoryMembership";
import type { CatalogIngredientCategory } from "../types";

export type AssignCategoryToIngredientsDialogProps = {
  category: CatalogIngredientCategory | null;
  selectedOutletId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssignCategoryToIngredientsDialog({
  category,
  selectedOutletId,
  open,
  onOpenChange,
}: AssignCategoryToIngredientsDialogProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows, setIngredientCategories, isSaving } = useCatalogIngredients();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const outletIngredients = useMemo(
    () => rows.filter((row) => (row.outlet_ids ?? []).includes(selectedOutletId)),
    [rows, selectedOutletId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return outletIngredients;
    return outletIngredients.filter((row) => row.name.toLowerCase().includes(q));
  }, [outletIngredients, query]);

  useEffect(() => {
    if (!open || !category) return;
    setQuery("");
    setSelectedIds(
      new Set(
        outletIngredients
          .filter((row) => row.category_id === category.id)
          .map((row) => row.id),
      ),
    );
  }, [open, category, outletIngredients]);

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!category) return;
    const changes = ingredientCategoryMembershipDiff(outletIngredients, category.id, selectedIds);
    setSaving(true);
    try {
      await setIngredientCategories(changes);
      toast({ title: t("ingredient.categories.assignSaved", "Ingredients updated.") });
      onOpenChange(false);
    } catch {
      toast({
        title: t("ingredient.categories.assignFailed", "Could not assign ingredients."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || isSaving;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("ingredient.categories.assignTitle", "Assign To Ingredient")}
          </DialogTitle>
        </div>
        <div className="space-y-3 p-4">
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ingredient.categories.assignSearch", "search")}
              className="pr-9"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          {outletIngredients.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t(
                "ingredient.categories.assignEmpty",
                "No ingredients assigned to this outlet.",
              )}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("ingredient.categories.assignNoMatch", "No matching ingredients.")}
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {filtered.map((row) => (
                <li key={row.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/60">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase text-muted-foreground">
                      {ingredientInitials(row.name) || "—"}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={(value) => toggle(row.id, value === true)}
                    />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="flex flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:flex-row sm:justify-between sm:space-x-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!category || busy || outletIngredients.length === 0}
          >
            {t("ingredient.categories.assignConfirm", "Move Selected Ingredients")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
