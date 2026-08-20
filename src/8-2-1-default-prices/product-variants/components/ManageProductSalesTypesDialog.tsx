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
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogSalesTypes } from "../../sales-types/hooks/useCatalogSalesTypes";

export type ManageProductSalesTypesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  selectedOutletId: string;
  onConfirm: (ids: string[]) => void;
};

export function ManageProductSalesTypesDialog({
  open,
  onOpenChange,
  selectedIds,
  selectedOutletId,
  onConfirm,
}: ManageProductSalesTypesDialogProps) {
  const { t } = useAppTranslation();
  const { rows, isLoading } = useCatalogSalesTypes();
  const [query, setQuery] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (!open) return;
    setDraftIds(selectedIds);
    setQuery("");
  }, [open, selectedIds]);

  const available = useMemo(() => {
    const selected = new Set(selectedIds);
    return rows.filter((row) => {
      if (selected.has(row.id)) return true;
      if (!row.is_active) return false;
      if (!selectedOutletId) return true;
      return row.outlet_ids.includes(selectedOutletId);
    });
  }, [rows, selectedIds, selectedOutletId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((row) => row.name.toLowerCase().includes(q));
  }, [available, query]);

  const canConfirm = draftIds.length >= 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("defaultPrices.product.pricing.manageSalesType", "Manage Sales Type")}
          </DialogTitle>
        </div>
        <div className="space-y-3 p-4">
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("defaultPrices.product.pricing.searchSalesType", "Search Sales Type")}
              className="pr-9"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>
              {t("defaultPrices.product.pricing.selectedCount", "{{count}} Sales Type selected", {
                count: draftIds.length,
              })}
            </span>
            <button
              type="button"
              className="text-primary disabled:text-muted-foreground"
              disabled={draftIds.length === 0}
              onClick={() => setDraftIds([])}
            >
              {t("defaultPrices.product.pricing.unselectAll", "Unselect All")}
            </button>
          </div>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("defaultPrices.loading", "Loading...")}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("defaultPrices.product.pricing.noSalesTypes", "No sales types yet.")}
            </p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {filtered.map((row) => (
                <li key={row.id} className="flex items-center justify-between border-b py-2 last:border-b-0">
                  <span className="text-sm">{row.name}</span>
                  <Checkbox
                    checked={draftIds.includes(row.id)}
                    onCheckedChange={(value) =>
                      setDraftIds((prev) =>
                        value === true
                          ? prev.includes(row.id)
                            ? prev
                            : [...prev, row.id]
                          : prev.filter((id) => id !== row.id),
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="flex flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={() => { if (canConfirm) { onConfirm(draftIds); onOpenChange(false); } }} disabled={!canConfirm}>
            {t("defaultPrices.product.inventory.confirm", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
