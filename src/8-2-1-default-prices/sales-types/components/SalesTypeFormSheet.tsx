import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogGratuities } from "../../gratuity";
import { useCatalogSalesTypes } from "../hooks/useCatalogSalesTypes";
import type { CatalogSalesType } from "../types";
import { SalesTypeOutletsSection } from "./SalesTypeOutletsSection";

export type SalesTypeFormSheetProps = {
  salesType: CatalogSalesType | null;
  selectedOutletId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : String(rounded)}%`;
}

export function SalesTypeFormSheet({
  salesType,
  selectedOutletId,
  open,
  onOpenChange,
}: SalesTypeFormSheetProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows: gratuities } = useCatalogGratuities();
  const { save, isSaving } = useCatalogSalesTypes();
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (salesType) {
      setName(salesType.name);
      setIsActive(salesType.is_active);
      setSelectedIds(new Set(salesType.gratuity_ids));
      setOutletIds([...(salesType.outlet_ids ?? [])]);
    } else {
      setName("");
      setIsActive(true);
      setSelectedIds(new Set());
      setOutletIds(selectedOutletId ? [selectedOutletId] : []);
    }
  }, [open, salesType, selectedOutletId]);

  const title = salesType
    ? t("defaultPrices.salesType.editTitle", "Edit sales type")
    : t("defaultPrices.salesType.addTitle", "New sales type");

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: t("defaultPrices.salesType.nameRequired", "Enter a sales type name."),
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
      await save({
        id: salesType?.id,
        name: trimmed,
        is_active: isActive,
        outlet_ids: outletIds,
        gratuity_ids: [...selectedIds],
      });
      toast({ title: t("defaultPrices.salesType.saved", "Sales type saved.") });
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
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
          <section className="space-y-3">
            <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("defaultPrices.salesType.section", "Sales type information")}
            </p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("defaultPrices.salesType.namePlaceholder", "Name")}
            />
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="sales-type-status">
                {t("defaultPrices.salesType.statusLabel", "Status")}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {isActive
                    ? t("defaultPrices.salesType.statusActive", "Active")
                    : t("defaultPrices.salesType.statusInactive", "Inactive")}
                </span>
                <Switch id="sales-type-status" checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
          </section>
          <SalesTypeOutletsSection selectedIds={outletIds} onChange={setOutletIds} />
          <section className="space-y-3">
            <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("defaultPrices.salesType.assignSection", "Assign gratuity")}
            </p>
            {gratuities.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                {t(
                  "defaultPrices.salesType.assignEmpty",
                  "No gratuities yet. Add them on the Gratuity page.",
                )}
              </p>
            ) : (
              <ul className="space-y-1">
                {gratuities.map((row) => {
                  const checked = selectedIds.has(row.id);
                  return (
                    <li key={row.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggle(row.id, value === true)}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
                        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                          {formatPercent(row.amount_percent)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
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
