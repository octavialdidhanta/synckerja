import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogProductCategories } from "../hooks/useCatalogProductCategories";
import type { CatalogProductCategory } from "../types";
import { CategoryOutletsSection } from "./CategoryOutletsSection";

export type CategoryFormSheetProps = {
  category: CatalogProductCategory | null;
  selectedOutletId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (category: CatalogProductCategory) => void;
};

export function CategoryFormSheet({
  category,
  selectedOutletId,
  open,
  onOpenChange,
  onCreated,
}: CategoryFormSheetProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save, isSaving } = useCatalogProductCategories();
  const [name, setName] = useState("");
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (category) {
      setName(category.name);
      setOutletIds([...(category.outlet_ids ?? [])]);
      return;
    }
    setName("");
    setOutletIds(selectedOutletId ? [selectedOutletId] : []);
  }, [open, category, selectedOutletId]);

  const title = category
    ? t("defaultPrices.category.editTitle", "Edit category")
    : t("defaultPrices.category.addTitle", "New category");

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: t("defaultPrices.product.categoryNameRequired", "Enter a category name."),
        variant: "destructive",
      });
      return;
    }
    if (outletIds.length < 1) {
      toast({
        title: t("outlets.assign.minOne", "Please select minimum one outlet"),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const saved = await save({
        id: category?.id,
        name: trimmed,
        outlet_ids: outletIds,
      });
      toast({ title: t("defaultPrices.category.saved", "Category saved.") });
      if (!category) onCreated?.(saved);
      onOpenChange(false);
    } catch {
      toast({
        title: t("defaultPrices.product.categorySaveFailed", "Could not save category."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || isSaving;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <section className="space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("defaultPrices.product.categoryPlaceholder", "e.g. Drinks")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
          </section>
          <CategoryOutletsSection selectedIds={outletIds} onChange={setOutletIds} />
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={busy}>
            {t("common.save", "Save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
