import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useDefaultPrices } from "../../hooks/useDefaultPrices";
import type { CatalogProductCategory } from "../types";

export type AssignCategoryToItemsDialogProps = {
  category: CatalogProductCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssignCategoryToItemsDialog({
  category,
  open,
  onOpenChange,
}: AssignCategoryToItemsDialogProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows, update, isUpdating } = useDefaultPrices();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const products = useMemo(
    () => rows.filter((row) => row.kind === "product"),
    [rows],
  );

  useEffect(() => {
    if (!open || !category) return;
    setSelectedIds(
      new Set(
        products.filter((row) => row.product_category_id === category.id).map((row) => row.id),
      ),
    );
  }, [open, category, products]);

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
    const changes = products.flatMap((row) => {
      const checked = selectedIds.has(row.id);
      const wasThis = row.product_category_id === category.id;
      if (checked && !wasThis) {
        return [{ id: row.id, payload: { product_category_id: category.id } }];
      }
      if (!checked && wasThis) {
        return [{ id: row.id, payload: { product_category_id: null } }];
      }
      return [];
    });

    setSaving(true);
    try {
      await Promise.all(changes.map((change) => update(change)));
      toast({ title: t("defaultPrices.category.assignSaved", "Products updated.") });
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

  const title = t("defaultPrices.category.assignDialogTitle", "Assign to {{name}}", {
    name: category?.name ?? "",
  });
  const busy = saving || isUpdating;

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
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {products.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {t(
                "defaultPrices.category.assignEmpty",
                "No products yet. Add items on the Products tab.",
              )}
            </p>
          ) : (
            <ul className="space-y-1">
              {products.map((row) => {
                const checked = selectedIds.has(row.id);
                const label = row.name || row.service_name || "—";
                return (
                  <li key={row.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggle(row.id, value === true)}
                      />
                      {row.photo_url ? (
                        <img src={row.photo_url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                      ) : null}
                      <span className="min-w-0 truncate text-sm">{label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <SheetFooter className="shrink-0 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!category || busy || products.length === 0}>
            {t("common.save", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
