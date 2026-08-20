import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { DefaultPriceRow } from "../../types/defaultPrices";

export type AddBundleItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: DefaultPriceRow[];
  excludeProductIds: string[];
  onAdd: (productId: string) => void;
};

export function AddBundleItemDialog({
  open,
  onOpenChange,
  products,
  excludeProductIds,
  onAdd,
}: AddBundleItemDialogProps) {
  const { t } = useAppTranslation();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const blocked = new Set(excludeProductIds);
    return products.filter((row) => {
      if (row.kind !== "product") return false;
      if (blocked.has(row.id)) return false;
      if (!q) return true;
      return (row.name ?? "").toLowerCase().includes(q);
    });
  }, [products, excludeProductIds, query]);

  const reset = () => {
    setQuery("");
    setSelectedId("");
    setTriedSubmit(false);
  };

  const handleAdd = () => {
    if (!selectedId) {
      setTriedSubmit(true);
      return;
    }
    onAdd(selectedId);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("defaultPrices.bundles.addItemTitle", "Add Item")}
          </DialogTitle>
        </div>
        <div className="space-y-3 p-4">
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("defaultPrices.bundles.itemSearch", "Search")}
              className="pr-9"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">{t("defaultPrices.bundles.selectItem", "Select Item")}</p>
          {options.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("defaultPrices.bundles.itemEmpty", "No products available.")}
            </p>
          ) : (
            <RadioGroup
              value={selectedId}
              onValueChange={setSelectedId}
              className="max-h-56 space-y-1 overflow-y-auto"
            >
              {options.map((product) => (
                <label
                  key={product.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-2 hover:bg-muted/60"
                >
                  <span className="text-sm">{product.name || product.id}</span>
                  <RadioGroupItem value={product.id} />
                </label>
              ))}
            </RadioGroup>
          )}
        </div>
        <DialogFooter className="flex-row items-center justify-between border-t px-4 py-3 sm:justify-between">
          {triedSubmit && !selectedId ? (
            <p className="text-sm text-destructive">
              {t("defaultPrices.bundles.itemRequired", "Please select the item")}
            </p>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="button" onClick={handleAdd}>
              {t("defaultPrices.bundles.addItem", "Add Item")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
