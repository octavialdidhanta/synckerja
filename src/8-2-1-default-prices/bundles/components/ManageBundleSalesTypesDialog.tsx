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

export type ManageBundleSalesTypesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  outletIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function ManageBundleSalesTypesDialog({
  open,
  onOpenChange,
  selectedIds,
  outletIds,
  onConfirm,
}: ManageBundleSalesTypesDialogProps) {
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
      if (outletIds.length === 0) return true;
      return row.outlet_ids.some((id) => outletIds.includes(id));
    });
  }, [rows, selectedIds, outletIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((row) => row.name.toLowerCase().includes(q));
  }, [available, query]);

  const canConfirm = draftIds.length >= 1;

  const toggle = (id: string, checked: boolean) => {
    setDraftIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((item) => item !== id);
    });
  };

  const handleUnselectAll = () => {
    setDraftIds([]);
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(draftIds);
    onOpenChange(false);
  };

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
            {t("defaultPrices.bundles.manageSalesTypeTitle", "Manage Sales Type")}
          </DialogTitle>
        </div>
        <div className="space-y-3 p-4">
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("defaultPrices.bundles.searchSalesType", "Search Sales Type")}
              className="pr-9"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>{t("defaultPrices.bundles.selectSalesType", "Select Sales type")}</span>
            <button
              type="button"
              className="text-primary disabled:text-muted-foreground"
              disabled={draftIds.length === 0}
              onClick={handleUnselectAll}
            >
              {t("defaultPrices.bundles.unselectAllSalesTypes", "Unselect All")}
            </button>
          </div>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("defaultPrices.loading", "Loading...")}
            </p>
          ) : available.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("defaultPrices.bundles.salesTypeEmpty", "No sales types yet.")}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("defaultPrices.bundles.salesTypeNoMatch", "No matching sales types.")}
            </p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {filtered.map((row) => (
                <li key={row.id}>
                  <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60">
                    <span className="min-w-0 flex-1 text-sm">{row.name}</span>
                    <Checkbox
                      checked={draftIds.includes(row.id)}
                      onCheckedChange={(value) => toggle(row.id, value === true)}
                    />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="flex-col items-stretch gap-2 border-t px-4 py-3 sm:flex-col sm:space-x-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("defaultPrices.bundles.selectedSalesTypeCount", "Selected Sales type: {{count}}", {
                  count: draftIds.length,
                })}
              </p>
              {!canConfirm ? (
                <p className="text-xs text-destructive">
                  {t("defaultPrices.bundles.salesTypeMinOne", "Please select minimum one sales type")}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
                {t("defaultPrices.bundles.confirmSalesType", "Confirm")}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
