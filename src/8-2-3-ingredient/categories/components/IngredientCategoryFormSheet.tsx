import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogIngredientCategories } from "../hooks/useCatalogIngredientCategories";
import type { CatalogIngredientCategory } from "../types";

export type IngredientCategoryFormSheetProps = {
  category: CatalogIngredientCategory | null;
  selectedOutletId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function IngredientCategoryFormSheet({
  category,
  selectedOutletId,
  open,
  onOpenChange,
}: IngredientCategoryFormSheetProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save, remove, isSaving } = useCatalogIngredientCategories();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setConfirmDelete(false);
  }, [open, category]);

  const isEdit = Boolean(category);
  const title = isEdit
    ? t("ingredient.categories.editTitle", "Edit Ingredient Category")
    : t("ingredient.categories.createTitle", "Create Ingredient Category");

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: t("ingredient.categories.nameRequired", "Enter a category name."),
        variant: "destructive",
      });
      return;
    }
    if (!isEdit && !selectedOutletId) {
      toast({
        title: t("ingredient.library.outletRequired", "Select an outlet first."),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await save({
        id: category?.id,
        name: trimmed,
        outlet_id: isEdit ? undefined : selectedOutletId,
      });
      toast({ title: t("ingredient.categories.saved", "Category saved.") });
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast({
        title:
          message === "ingredient_category_duplicate"
            ? t(
                "ingredient.categories.duplicateName",
                "A category with this name already exists.",
              )
            : t("ingredient.categories.saveFailed", "Could not save category."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    setSaving(true);
    try {
      await remove(category.id);
      toast({ title: t("ingredient.categories.deleted", "Category deleted.") });
      setConfirmDelete(false);
      onOpenChange(false);
    } catch {
      toast({
        title: t("ingredient.categories.deleteFailed", "Could not delete category."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || isSaving;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
          aria-describedby={undefined}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <section className="space-y-3">
              <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("ingredient.categories.sectionLabel", "Ingredient Category")}
              </p>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(
                  "ingredient.categories.namePlaceholder",
                  "Ingredient Category Name",
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSave();
                  }
                }}
              />
            </section>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t px-6 py-4">
            {isEdit ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                aria-label={t("common.delete", "Delete")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={busy}>
                {t("common.save", "Save")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("ingredient.categories.deleteTitle", "Delete category?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "ingredient.categories.deleteBody",
                "Delete {{name}}? Ingredients in this category become Uncategorized.",
                { name: category?.name ?? "" },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
