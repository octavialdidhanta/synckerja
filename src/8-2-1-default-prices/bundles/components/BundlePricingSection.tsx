import { useMemo, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { useCatalogSalesTypes } from "../../sales-types/hooks/useCatalogSalesTypes";
import type { DefaultPriceRow } from "../../types/defaultPrices";
import type { BundleDraft } from "../types";
import { ManageBundleSalesTypesDialog } from "./ManageBundleSalesTypesDialog";

export type BundlePricingSectionProps = {
  draft: BundleDraft;
  products: DefaultPriceRow[];
  onChange: (patch: Partial<BundleDraft>) => void;
};

export function BundlePricingSection({ draft, products, onChange }: BundlePricingSectionProps) {
  const { t } = useAppTranslation();
  const { rows: salesTypes } = useCatalogSalesTypes();
  const [manageOpen, setManageOpen] = useState(false);

  const itemsSum = draft.items.reduce((sum, item) => {
    const product = products.find((row) => row.id === item.product_id);
    const qty = Number(item.quantity) || 0;
    return sum + (product?.unit_price ?? 0) * qty;
  }, 0);

  const selectedSalesTypes = useMemo(() => {
    const selected = new Set(Object.keys(draft.sales_type_price_displays));
    const listed = salesTypes.filter((row) => selected.has(row.id));
    const listedIds = new Set(listed.map((row) => row.id));
    const missing = Object.keys(draft.sales_type_price_displays)
      .filter((id) => !listedIds.has(id))
      .map((id) => ({ id, name: id }));
    return [...listed, ...missing];
  }, [salesTypes, draft.sales_type_price_displays]);

  const handleToggleSalesTypePrices = (checked: boolean) => {
    if (checked) {
      onChange({ use_sales_type_prices: true });
      return;
    }
    onChange({
      use_sales_type_prices: false,
      sales_type_price_displays: {},
    });
  };

  const handleConfirmSalesTypes = (ids: string[]) => {
    const next: Record<string, string> = {};
    for (const id of ids) {
      next[id] = draft.sales_type_price_displays[id] ?? "";
    }
    onChange({ sales_type_price_displays: next });
  };

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="text-base font-semibold">
        {t("defaultPrices.bundles.pricingSection", "Bundle Pricing")}
      </h3>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={draft.use_sales_type_prices}
          onCheckedChange={(value) => handleToggleSalesTypePrices(value === true)}
        />
        <span>{t("defaultPrices.bundles.applySalesTypePrices", "Apply multiple price per sales type")}</span>
      </label>

      {draft.use_sales_type_prices ? (
        <>
          {selectedSalesTypes.map((row) => (
            <div key={row.id} className="flex items-center gap-3">
              <Label htmlFor={`bundle-price-${row.id}`} className="w-40 shrink-0 text-sm">
                {row.name}
              </Label>
              <span className="text-sm text-muted-foreground">Rp</span>
              <Input
                id={`bundle-price-${row.id}`}
                inputMode="numeric"
                value={draft.sales_type_price_displays[row.id] ?? ""}
                onChange={(e) =>
                  onChange({
                    sales_type_price_displays: {
                      ...draft.sales_type_price_displays,
                      [row.id]: e.target.value.replace(/[^\d]/g, ""),
                    },
                  })
                }
                placeholder={t("defaultPrices.bundles.bundlePricePlaceholder", "Input bundle price...")}
                className="flex-1"
              />
            </div>
          ))}
          {selectedSalesTypes.length === 0 ? (
            <p className="text-xs text-destructive">
              {t("defaultPrices.bundles.salesTypeMinOne", "Please select minimum one sales type")}
            </p>
          ) : null}
          <Button type="button" className="w-full" onClick={() => setManageOpen(true)}>
            {t("defaultPrices.bundles.manageSalesType", "Manage Sales Type")}
          </Button>
          <ManageBundleSalesTypesDialog
            open={manageOpen}
            onOpenChange={setManageOpen}
            selectedIds={Object.keys(draft.sales_type_price_displays)}
            outletIds={draft.outlet_ids}
            onConfirm={handleConfirmSalesTypes}
          />
        </>
      ) : (
        <div className="flex items-center gap-4">
          <Label htmlFor="bundle-price" className="w-40 shrink-0 text-sm text-muted-foreground">
            {t("defaultPrices.bundles.priceLabel", "Bundle Price (Rp)")}
          </Label>
          <Input
            id="bundle-price"
            inputMode="numeric"
            value={draft.bundle_price_display}
            onChange={(e) => onChange({ bundle_price_display: e.target.value.replace(/[^\d]/g, "") })}
            placeholder="0"
            className="flex-1"
          />
        </div>
      )}

      {itemsSum > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("defaultPrices.bundles.itemsSum", "Sum of items: {{amount}}", {
            amount: formatToRupiah(itemsSum),
          })}
        </p>
      ) : null}
    </section>
  );
}
