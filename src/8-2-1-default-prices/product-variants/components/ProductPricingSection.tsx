import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { FieldInfoTip } from "../../components/FieldInfoTip";
import { useCatalogSalesTypes } from "../../sales-types/hooks/useCatalogSalesTypes";
import { formatIdIntegerGrouping, stripToDigits } from "../../utils/formatIdUnitPrice";
import type { VariantDraft } from "../types";
import { AddProductVariantDialog } from "./AddProductVariantDialog";
import { ManageProductSalesTypesDialog } from "./ManageProductSalesTypesDialog";

export type ProductPricingSectionProps = {
  selectedOutletId: string;
  useSalesTypePrices: boolean;
  onUseSalesTypePrices: (next: boolean) => void;
  catalogSku: string;
  onCatalogSku: (next: string) => void;
  unitPrice: string;
  onUnitPrice: (next: string) => void;
  variants: VariantDraft[];
  onVariants: (next: VariantDraft[]) => void;
  productSalesTypeDisplays: Record<string, string>;
  onProductSalesTypeDisplays: (next: Record<string, string>) => void;
  variantSalesTypeDisplays: Record<string, Record<string, string>>;
  onVariantSalesTypeDisplays: (next: Record<string, Record<string, string>>) => void;
  hideHeading?: boolean;
};

export function ProductPricingSection({
  selectedOutletId,
  useSalesTypePrices,
  onUseSalesTypePrices,
  catalogSku,
  onCatalogSku,
  unitPrice,
  onUnitPrice,
  variants,
  onVariants,
  productSalesTypeDisplays,
  onProductSalesTypeDisplays,
  variantSalesTypeDisplays,
  onVariantSalesTypeDisplays,
  hideHeading,
}: ProductPricingSectionProps) {
  const { t } = useAppTranslation();
  const { rows: salesTypes } = useCatalogSalesTypes();
  const [variantOpen, setVariantOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);

  const salesTypeName = useMemo(() => {
    const map = new Map(salesTypes.map((row) => [row.id, row.name]));
    return (id: string) => map.get(id) ?? id;
  }, [salesTypes]);

  const selectedSalesTypeIds =
    variants.length === 0
      ? Object.keys(productSalesTypeDisplays)
      : [...new Set(Object.values(variantSalesTypeDisplays).flatMap((row) => Object.keys(row)))];

  const handleConfirmSalesTypes = (ids: string[]) => {
    if (variants.length === 0) {
      const next: Record<string, string> = {};
      for (const id of ids) next[id] = productSalesTypeDisplays[id] ?? "";
      onProductSalesTypeDisplays(next);
      return;
    }
    const next: Record<string, Record<string, string>> = {};
    for (const variant of variants) {
      const prev = variantSalesTypeDisplays[variant.id] ?? {};
      const row: Record<string, string> = {};
      for (const id of ids) row[id] = prev[id] ?? "";
      next[variant.id] = row;
    }
    onVariantSalesTypeDisplays(next);
  };

  return (
    <section className="space-y-3">
      {hideHeading ? null : (
        <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("defaultPrices.product.pricing.section", "Pricing")}
        </p>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={useSalesTypePrices}
          onCheckedChange={(value) => onUseSalesTypePrices(value === true)}
        />
        <span>{t("defaultPrices.product.pricing.applyMultiple", "Apply multiple price per sales type")}</span>
      </label>

      {variants.length === 0 ? (
        <div className="overflow-hidden rounded-md border">
          <div className="flex items-center gap-1 bg-muted/50 px-3 py-1.5 text-xs font-medium uppercase text-muted-foreground">
            {t("defaultPrices.product.sku", "SKU")}
            <FieldInfoTip
              text={t(
                "defaultPrices.product.skuTooltip",
                "Optional internal code for this item. Variants can have their own SKU.",
              )}
            />
          </div>
          <div className="p-3">
            <Input
              value={catalogSku}
              onChange={(e) => onCatalogSku(e.target.value)}
              placeholder={t("defaultPrices.product.sku", "SKU")}
            />
          </div>
          {!useSalesTypePrices ? (
            <div className="border-t p-3">
              <Label className="text-xs text-muted-foreground">
                {t("defaultPrices.form.unitPrice", "Unit Price (Rp)")}
              </Label>
              <Input
                className="mt-1"
                inputMode="numeric"
                value={unitPrice}
                onChange={(e) => {
                  const digits = stripToDigits(e.target.value);
                  onUnitPrice(digits ? formatIdIntegerGrouping(digits) : "");
                }}
              />
            </div>
          ) : null}
          <Button type="button" className="w-full rounded-none" onClick={() => setVariantOpen(true)}>
            {t("defaultPrices.product.variant.addButton", "Add Variant")}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[1fr_6rem_6rem] gap-2 bg-muted/50 px-3 py-1.5 text-xs font-medium uppercase text-muted-foreground">
            <span>{t("defaultPrices.product.variant.name", "Variant Name")}</span>
            <span>{t("defaultPrices.form.unitPrice", "Price")}</span>
            <span>{t("defaultPrices.product.sku", "SKU")}</span>
          </div>
          {variants.map((row) => (
            <div key={row.id} className="grid grid-cols-[1fr_6rem_6rem] gap-2 border-t px-3 py-2 text-sm">
              <span className="truncate">{row.name}</span>
              <span>{row.priceDisplay || "0"}</span>
              <span className="truncate">{row.sku || "—"}</span>
            </div>
          ))}
          <Button type="button" className="w-full rounded-none" onClick={() => setVariantOpen(true)}>
            {t("defaultPrices.product.variant.addButton", "Add Variant")}
          </Button>
        </div>
      )}

      {useSalesTypePrices ? (
        <div className="space-y-3">
          {selectedSalesTypeIds.length === 0 ? (
            <p className="text-xs text-destructive">
              {t("defaultPrices.product.pricing.minOne", "Please select minimum one sales type")}
            </p>
          ) : variants.length === 0 ? (
            selectedSalesTypeIds.map((id) => (
              <div key={id} className="space-y-1">
                <p className="text-sm font-medium">{salesTypeName(id)}</p>
                <div className="flex gap-2">
                  <Input
                    value={productSalesTypeDisplays[id] ?? ""}
                    onChange={(e) => {
                      const digits = stripToDigits(e.target.value);
                      onProductSalesTypeDisplays({
                        ...productSalesTypeDisplays,
                        [id]: digits ? formatIdIntegerGrouping(digits) : "",
                      });
                    }}
                    placeholder={t("defaultPrices.form.unitPrice", "Price")}
                    inputMode="numeric"
                  />
                  <Input value={catalogSku} readOnly className="bg-muted" />
                </div>
              </div>
            ))
          ) : (
            selectedSalesTypeIds.map((id) => (
              <div key={id} className="space-y-2">
                <p className="text-sm font-medium">{salesTypeName(id)}</p>
                {variants.map((variant) => (
                  <div key={variant.id} className="grid grid-cols-[1fr_7rem_6rem] items-center gap-2">
                    <span className="truncate text-sm">{variant.name}</span>
                    <Input
                      value={variantSalesTypeDisplays[variant.id]?.[id] ?? ""}
                      onChange={(e) => {
                        const digits = stripToDigits(e.target.value);
                        onVariantSalesTypeDisplays({
                          ...variantSalesTypeDisplays,
                          [variant.id]: {
                            ...(variantSalesTypeDisplays[variant.id] ?? {}),
                            [id]: digits ? formatIdIntegerGrouping(digits) : "",
                          },
                        });
                      }}
                      placeholder="Price"
                      inputMode="numeric"
                    />
                    <Input value={variant.sku} readOnly className="bg-muted" />
                  </div>
                ))}
              </div>
            ))
          )}
          <Button type="button" className="w-full" onClick={() => setSalesOpen(true)}>
            {t("defaultPrices.product.pricing.addSalesType", "Add Sales Type")}
          </Button>
        </div>
      ) : null}

      <AddProductVariantDialog
        open={variantOpen}
        onOpenChange={setVariantOpen}
        variants={variants}
        onConfirm={onVariants}
      />
      <ManageProductSalesTypesDialog
        open={salesOpen}
        onOpenChange={setSalesOpen}
        selectedIds={selectedSalesTypeIds}
        selectedOutletId={selectedOutletId}
        onConfirm={handleConfirmSalesTypes}
      />
    </section>
  );
}
