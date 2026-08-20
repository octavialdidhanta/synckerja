import { useState } from "react";
import { CircleAlert, CircleX, Pencil } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { DefaultPriceRow } from "../../types/defaultPrices";
import type { BundleDraft } from "../types";
import { newBundleItemDraft } from "../types";
import { AddBundleItemDialog } from "./AddBundleItemDialog";

export type BundleItemsSectionProps = {
  draft: BundleDraft;
  products: DefaultPriceRow[];
  onChange: (patch: Partial<BundleDraft>) => void;
};

export function BundleItemsSection({ draft, products, onChange }: BundleItemsSectionProps) {
  const { t } = useAppTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const productName = (id: string) => products.find((row) => row.id === id)?.name || id;

  const excludeIds = draft.items
    .filter((item) => (editingKey ? item.key !== editingKey : true))
    .map((item) => item.product_id)
    .filter(Boolean);

  const handleAdd = (productId: string) => {
    if (editingKey) {
      onChange({
        items: draft.items.map((item) =>
          item.key === editingKey ? { ...item, product_id: productId } : item,
        ),
      });
      setEditingKey(null);
      return;
    }
    onChange({
      items: [...draft.items, { ...newBundleItemDraft(), product_id: productId }],
    });
  };

  const updateQty = (key: string, raw: string) => {
    const quantity = raw.replace(/[^\d]/g, "");
    onChange({
      items: draft.items.map((item) => (item.key === key ? { ...item, quantity } : item)),
    });
  };

  const removeItem = (key: string) => {
    onChange({ items: draft.items.filter((item) => item.key !== key) });
  };

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h3 className="text-base font-semibold">
        {t("defaultPrices.bundles.itemsSection", "Bundle Items")}
      </h3>
      {draft.items.map((item, index) => (
        <div key={item.key} className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
          <div className="flex items-center gap-3">
            <Label className="w-16 shrink-0 text-sm text-muted-foreground">
              {t("defaultPrices.bundles.itemN", "Item {{n}}", { n: index + 1 })}
            </Label>
            <Input readOnly value={productName(item.product_id)} className="flex-1 bg-muted" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary"
              onClick={() => {
                setEditingKey(item.key);
                setPickerOpen(true);
              }}
              aria-label={t("common.edit", "Edit")}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => removeItem(item.key)}
              aria-label={t("common.delete", "Delete")}
            >
              <CircleX className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3 pl-[4.75rem]">
            <Label className="text-sm text-muted-foreground">
              {t("defaultPrices.bundles.quantity", "Quantity")}
            </Label>
            <Input
              inputMode="numeric"
              value={item.quantity}
              onChange={(e) => updateQty(item.key, e.target.value)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              {t("defaultPrices.bundles.pcs", "Pcs")}
            </span>
          </div>
        </div>
      ))}
      <div className="flex justify-center">
        <Button
          type="button"
          onClick={() => {
            setEditingKey(null);
            setPickerOpen(true);
          }}
        >
          {t("defaultPrices.bundles.addItem", "Add Item")}
        </Button>
      </div>
      <div className="flex gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          {t(
            "defaultPrices.bundles.itemsBanner",
            "Make sure your item is listed on the assign outlets. Bundle will be shown, but it can't be purchased if item isn't listed.",
          )}
        </p>
      </div>
      <AddBundleItemDialog
        open={pickerOpen}
        onOpenChange={(next) => {
          if (!next) setEditingKey(null);
          setPickerOpen(next);
        }}
        products={products}
        excludeProductIds={excludeIds}
        onAdd={handleAdd}
      />
    </section>
  );
}
