import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatIdIntegerGrouping, stripToDigits } from "../../utils/formatIdUnitPrice";
import { newVariantDraft, type VariantDraft } from "../types";

export type AddProductVariantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variants: VariantDraft[];
  onConfirm: (variants: VariantDraft[]) => void;
};

export function AddProductVariantDialog({
  open,
  onOpenChange,
  variants,
  onConfirm,
}: AddProductVariantDialogProps) {
  const { t } = useAppTranslation();
  const [rows, setRows] = useState<VariantDraft[]>(variants);

  useEffect(() => {
    if (!open) return;
    setRows(variants.length > 0 ? variants.map((row) => ({ ...row })) : [newVariantDraft()]);
  }, [open, variants]);

  const handleConfirm = () => {
    const next = rows.filter((row) => row.name.trim());
    if (next.length === 0) return;
    onConfirm(next);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("defaultPrices.product.variant.addTitle", "Add Variant")}
          </DialogTitle>
        </div>
        <div className="space-y-3 p-4">
          <Button
            type="button"
            className="w-full"
            onClick={() => setRows((prev) => [...prev, newVariantDraft()])}
          >
            {t("defaultPrices.product.variant.addTitle", "Add Variant")}
          </Button>
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                value={row.name}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((item) => (item.id === row.id ? { ...item, name: e.target.value } : item)),
                  )
                }
                placeholder={t("defaultPrices.product.variant.name", "Variant Name")}
              />
              <div className="relative w-28 shrink-0">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  Rp
                </span>
                <Input
                  value={row.priceDisplay}
                  onChange={(e) => {
                    const digits = stripToDigits(e.target.value);
                    setRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? { ...item, priceDisplay: digits ? formatIdIntegerGrouping(digits) : "" }
                          : item,
                      ),
                    );
                  }}
                  placeholder="0"
                  className="pl-7"
                  inputMode="numeric"
                />
              </div>
              <Input
                value={row.sku}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((item) => (item.id === row.id ? { ...item, sku: e.target.value } : item)),
                  )
                }
                placeholder={t("defaultPrices.product.sku", "SKU")}
                className="w-28 shrink-0"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={() => setRows((prev) => prev.filter((item) => item.id !== row.id))}
                aria-label={t("common.delete", "Delete")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter className="flex flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!rows.some((row) => row.name.trim())}>
            {t("defaultPrices.product.inventory.confirm", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
