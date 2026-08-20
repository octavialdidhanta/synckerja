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
import { useCatalogBrands } from "../hooks/useCatalogBrands";
import type { CatalogBrand } from "../types";
import { BrandOutletsSection } from "./BrandOutletsSection";

export type BrandFormSheetProps = {
  brand: CatalogBrand | null;
  selectedOutletId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BrandFormSheet({ brand, selectedOutletId, open, onOpenChange }: BrandFormSheetProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save, isSaving } = useCatalogBrands();
  const [name, setName] = useState("");
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (brand) {
      setName(brand.name);
      setOutletIds([...(brand.outlet_ids ?? [])]);
      return;
    }
    setName("");
    setOutletIds(selectedOutletId ? [selectedOutletId] : []);
  }, [open, brand, selectedOutletId]);

  const title = brand
    ? t("defaultPrices.brands.editTitle", "Edit brand")
    : t("defaultPrices.brands.createTitle", "Create Brands");

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: t("defaultPrices.brands.nameRequired", "Enter a brand name."),
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
      await save({ id: brand?.id, name: trimmed, outlet_ids: outletIds });
      toast({ title: t("defaultPrices.brands.saved", "Brand saved.") });
      onOpenChange(false);
    } catch {
      toast({
        title: t("defaultPrices.form.saveFailed", "Failed to save."),
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
          <section className="space-y-3">
            <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("defaultPrices.brands.section", "Brand")}
            </p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("defaultPrices.brands.namePlaceholder", "Brand Name")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
          </section>
          <BrandOutletsSection selectedIds={outletIds} onChange={setOutletIds} />
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
