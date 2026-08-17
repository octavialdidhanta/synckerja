import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Edit2, Trash2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/components/ui/use-toast";
import { useCatalogProductCategories } from "../hooks/useCatalogProductCategories";
import type { CatalogProductCategory } from "../types/catalogProductCategory";

export type ProductCategoriesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (category: CatalogProductCategory) => void;
};

export function ProductCategoriesDialog({ open, onOpenChange, onSelect }: ProductCategoriesDialogProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const categories = useCatalogProductCategories();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<CatalogProductCategory | null>(null);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: t("defaultPrices.product.categoryNameRequired", "Enter a category name."),
        variant: "destructive",
      });
      return;
    }
    try {
      if (editing) {
        await categories.rename({ id: editing.id, name: trimmed });
      } else {
        const created = await categories.create(trimmed);
        if (created?.id && onSelect) {
          onSelect({
            id: created.id,
            organization_id: "",
            name: trimmed,
            sort_order: 0,
            is_active: true,
          });
        }
      }
      setName("");
      setEditing(null);
    } catch {
      toast({
        title: t("defaultPrices.product.categorySaveFailed", "Could not save category."),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (row: CatalogProductCategory) => {
    try {
      await categories.remove(row.id);
      if (editing?.id === row.id) {
        setEditing(null);
        setName("");
      }
    } catch {
      toast({
        title: t("defaultPrices.product.categoryDeleteFailed", "Could not delete category."),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setName("");
          setEditing(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("defaultPrices.product.manageCategories", "Manage categories")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="product_category_name">
              {editing
                ? t("defaultPrices.product.editCategory", "Edit category")
                : t("defaultPrices.product.newCategory", "New category")}
            </Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="product_category_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("defaultPrices.product.categoryPlaceholder", "e.g. Drinks")}
              />
              <Button type="button" onClick={() => void handleSave()} disabled={categories.isSaving}>
                {editing ? t("common.update", "Update") : t("common.add", "Add")}
              </Button>
            </div>
          </div>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {categories.rows.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                {t("defaultPrices.product.noCategories", "No categories yet.")}
              </li>
            ) : (
              categories.rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm"
                    onClick={() => onSelect?.(row)}
                  >
                    {row.name}
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditing(row);
                        setName(row.name);
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => void handleDelete(row)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
