import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogIngredientCategories } from "../../categories/hooks/useCatalogIngredientCategories";

export type CreateIngredientCategoryDialogProps = {
  open: boolean;
  /** Name typed in the combobox; prefilled into the modal. */
  initialName: string;
  outletId: string;
  categories: Array<{ id: string; name: string }>;
  onOpenChange: (open: boolean) => void;
  /** Called with the saved (or already existing) category id. */
  onSaved: (categoryId: string) => void;
};

/** Modal opened from the ingredient category combobox to create a new category. */
export function CreateIngredientCategoryDialog({
  open,
  initialName,
  outletId,
  categories,
  onOpenChange,
  onSaved,
}: CreateIngredientCategoryDialogProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save } = useCatalogIngredientCategories();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: t("ingredient.categories.nameRequired", "Enter a category name."),
        variant: "destructive",
      });
      return;
    }
    if (!outletId) {
      toast({
        title: t("ingredient.library.outletRequired", "Select an outlet first."),
        variant: "destructive",
      });
      return;
    }
    const already = categories.find((row) => row.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (already) {
      onSaved(already.id);
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      const saved = await save({ name: trimmed, outlet_id: outletId });
      toast({ title: t("ingredient.categories.saved", "Category saved.") });
      onSaved(saved.id);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast({
        title:
          message === "ingredient_category_duplicate"
            ? t("ingredient.categories.duplicateName", "A category with this name already exists.")
            : t("ingredient.categories.saveFailed", "Could not save category."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("ingredient.categories.createTitle", "Create Ingredient Category")}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          disabled={saving}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("ingredient.categories.namePlaceholder", "Ingredient Category Name")}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleSave();
            }
          }}
        />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" disabled={saving || !name.trim()} onClick={() => void handleSave()}>
            {saving ? t("common.saving", "Saving...") : t("common.save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
