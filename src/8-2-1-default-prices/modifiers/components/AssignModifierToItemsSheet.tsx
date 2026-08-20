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
import { useCatalogModifierGroups } from "../hooks/useCatalogModifierGroups";
import type { CatalogModifierGroup } from "../types";

export type AssignModifierToItemsSheetProps = {
  group: CatalogModifierGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssignModifierToItemsSheet({
  group,
  open,
  onOpenChange,
}: AssignModifierToItemsSheetProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows } = useDefaultPrices();
  const { assignProducts, isSaving } = useCatalogModifierGroups();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const products = useMemo(
    () => rows.filter((row) => row.kind === "product"),
    [rows],
  );

  useEffect(() => {
    if (!open || !group) return;
    setSelectedIds(new Set(group.product_ids));
  }, [open, group]);

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!group) return;
    setSaving(true);
    try {
      await assignProducts({ groupId: group.id, productIds: [...selectedIds] });
      toast({ title: t("defaultPrices.modifiers.assignSaved", "Products updated.") });
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

  const title = t("defaultPrices.modifiers.assignDialogTitle", "Assign to {{name}}", {
    name: group?.name ?? "",
  });
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
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {products.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {t(
                "defaultPrices.modifiers.assignEmpty",
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
          <Button type="button" onClick={() => void handleSave()} disabled={!group || busy || products.length === 0}>
            {t("common.save", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
