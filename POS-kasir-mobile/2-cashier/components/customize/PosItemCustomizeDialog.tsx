import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type {
  CustomerVisitCartLine,
  CustomerVisitCatalogItem,
} from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { usePosCashierIsPhoneLayout } from "../../hooks/usePosCashierIsPhoneLayout";
import { usePosItemCustomizeOptions } from "../../hooks/usePosItemCustomizeOptions";
import { buildCustomizeCartLine } from "../../lib/buildCustomizeCartLine";
import { computeCustomizeLineTotal } from "../../lib/computeCustomizeUnitPrice";
import { POS_ITEM_CUSTOMIZE_I18N } from "../../lib/posItemCustomizeCopy";
import { PosVariantSection } from "./PosVariantSection";
import { PosModifierGroupSection } from "./PosModifierGroupSection";
import { PosQtyStepper } from "./PosQtyStepper";
import { PosLineDiscountSection } from "./PosLineDiscountSection";
import { PosLineSalesTypeSection } from "./PosLineSalesTypeSection";

type Props = {
  open: boolean;
  item: CustomerVisitCatalogItem | null;
  outletId: string | null;
  /** Current bill sales type — preferred default when STP exists. */
  billSalesTypeId: string | null;
  onCancel: () => void;
  onSave: (line: CustomerVisitCartLine) => void;
};

export function PosItemCustomizeDialog({
  open,
  item,
  outletId,
  billSalesTypeId,
  onCancel,
  onSave,
}: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const optionsQuery = usePosItemCustomizeOptions({
    outletId,
    productId: item?.id ?? null,
    enabled: open && Boolean(item),
  });

  const [variantId, setVariantId] = useState<string | null>(null);
  const [modifierByGroup, setModifierByGroup] = useState<Record<string, string[]>>(
    {},
  );
  const [quantity, setQuantity] = useState(1);
  const [discountId, setDiscountId] = useState<string | null>(null);
  const [customDiscountAmount, setCustomDiscountAmount] = useState("");
  const [salesTypeId, setSalesTypeId] = useState<string | null>(null);

  const data = optionsQuery.data;

  useEffect(() => {
    if (!open || !item || !data) return;
    const firstVariant = data.variants[0]?.id ?? null;
    setVariantId(firstVariant);
    setQuantity(1);
    setDiscountId(null);
    setCustomDiscountAmount("");

    const nextMods: Record<string, string[]> = {};
    for (const g of data.modifierGroups) {
      if (g.isRequired && g.options.length === 1 && !g.options[0].outOfStock) {
        nextMods[g.id] = [g.options[0].id];
      } else {
        nextMods[g.id] = [];
      }
    }
    setModifierByGroup(nextMods);

    if (data.useSalesTypePrices && data.salesTypePrices.length > 0) {
      const forVariant = data.salesTypePrices.filter(
        (p) => !p.variantId || p.variantId === firstVariant,
      );
      const pool = forVariant.length > 0 ? forVariant : data.salesTypePrices;
      const prefer =
        pool.find((p) => p.salesTypeId === billSalesTypeId) ?? pool[0];
      setSalesTypeId(prefer?.salesTypeId ?? null);
    } else {
      setSalesTypeId(null);
    }
  }, [open, item, data, billSalesTypeId]);

  const selectedVariant = data?.variants.find((v) => v.id === variantId) ?? null;

  const stpForSelection = useMemo(() => {
    if (!data?.useSalesTypePrices) return [];
    return data.salesTypePrices.filter(
      (p) => !p.variantId || p.variantId === variantId,
    );
  }, [data, variantId]);

  const uniqueSalesTypes = useMemo(() => {
    const seen = new Set<string>();
    const rows = [];
    for (const p of stpForSelection) {
      if (seen.has(p.salesTypeId)) continue;
      seen.add(p.salesTypeId);
      rows.push(p);
    }
    return rows;
  }, [stpForSelection]);

  const selectedStp =
    uniqueSalesTypes.find((p) => p.salesTypeId === salesTypeId) ?? null;

  const baseUnitPrice = useMemo(() => {
    if (selectedStp) return selectedStp.price;
    if (selectedVariant) return selectedVariant.price;
    return item?.unitPrice ?? 0;
  }, [selectedStp, selectedVariant, item]);

  const selectedModifiers = useMemo(() => {
    if (!data) return [];
    const out = [];
    for (const g of data.modifierGroups) {
      const ids = modifierByGroup[g.id] ?? [];
      for (const id of ids) {
        const opt = g.options.find((o) => o.id === id);
        if (opt) {
          out.push({
            optionId: opt.id,
            name: opt.name,
            extraPrice: opt.extraPrice,
          });
        }
      }
    }
    return out;
  }, [data, modifierByGroup]);

  const lineDiscount = useMemo(() => {
    if (!data || !discountId) return null;
    const d = data.discounts.find((x) => x.id === discountId);
    if (!d) return null;
    const extras = selectedModifiers.reduce((s, m) => s + m.extraPrice, 0);
    const gross = (baseUnitPrice + extras) * quantity;
    let amountRp = 0;
    if (d.inputConfiguration === "customizable") {
      amountRp = Math.max(0, Math.round(Number(customDiscountAmount) || 0));
    } else if (d.amountUnit === "percent") {
      amountRp = Math.round((gross * (d.amountValue ?? 0)) / 100);
    } else {
      amountRp = Math.round(d.amountValue ?? 0);
    }
    amountRp = Math.min(amountRp, gross);
    return { id: d.id, name: d.name, amountRp };
  }, [
    data,
    discountId,
    customDiscountAmount,
    baseUnitPrice,
    selectedModifiers,
    quantity,
  ]);

  const liveTotal = computeCustomizeLineTotal({
    baseUnitPrice,
    modifiers: selectedModifiers,
    lineDiscountAmountRp: lineDiscount?.amountRp ?? 0,
    quantity,
  });

  const valid = useMemo(() => {
    if (!item || !data) return false;
    if (data.variants.length > 0 && !variantId) return false;
    for (const g of data.modifierGroups) {
      const ids = modifierByGroup[g.id] ?? [];
      if (ids.length < g.minSelected) return false;
      if (ids.length > g.maxSelected) return false;
    }
    if (data.useSalesTypePrices && uniqueSalesTypes.length > 0 && !salesTypeId) {
      return false;
    }
    if (!(liveTotal > 0)) return false;
    if (data.baseRecipeAvailableQty != null && data.baseRecipeAvailableQty <= 0) return false;
    return true;
  }, [
    item,
    data,
    variantId,
    modifierByGroup,
    uniqueSalesTypes,
    salesTypeId,
    liveTotal,
  ]);

  const toggleModifier = (groupId: string, optionId: string) => {
    const group = data?.modifierGroups.find((g) => g.id === groupId);
    if (!group) return;
    const option = group.options.find((o) => o.id === optionId);
    if (option?.outOfStock) return;
    setModifierByGroup((prev) => {
      const cur = prev[groupId] ?? [];
      if (group.singleSelect) {
        return { ...prev, [groupId]: cur.includes(optionId) ? [] : [optionId] };
      }
      if (cur.includes(optionId)) {
        return { ...prev, [groupId]: cur.filter((id) => id !== optionId) };
      }
      if (cur.length >= group.maxSelected) return prev;
      return { ...prev, [groupId]: [...cur, optionId] };
    });
  };

  if (!item) return null;

  const maxQty = (() => {
    const caps: number[] = [];
    if (selectedVariant?.availableQty != null) caps.push(selectedVariant.availableQty);
    else if (item.trackStock && item.availableQty != null) caps.push(item.availableQty);
    if (data?.baseRecipeAvailableQty != null) caps.push(data.baseRecipeAvailableQty);
    if (caps.length === 0) return null;
    return Math.max(0, Math.min(...caps));
  })();

  const handleOpenChange = (next: boolean) => {
    if (!next) onCancel();
  };

  const header = (titleNode: ReactNode) => (
    <div className="relative flex flex-shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
      <Button
        type="button"
        variant="outline"
        className="border-primary text-primary"
        onClick={onCancel}
      >
        {t(POS_ITEM_CUSTOMIZE_I18N.cancel, "Cancel")}
      </Button>
      <div className="min-w-0 flex-1 text-center">
        {titleNode}
        <p className="text-sm font-medium text-primary tabular-nums">
          {formatStoreCheckoutRp(liveTotal)}
        </p>
      </div>
      <Button
        type="button"
        disabled={!valid || optionsQuery.isLoading}
        onClick={() => {
          if (!valid) return;
          const line = buildCustomizeCartLine({
            item,
            quantity,
            variantId,
            variantName: selectedVariant?.name ?? null,
            baseUnitPrice,
            modifiers: selectedModifiers,
            lineDiscount,
            lineSalesTypeId: selectedStp?.salesTypeId ?? null,
            lineSalesTypeLabel: selectedStp?.name ?? null,
          });
          onSave(line);
        }}
      >
        {t(POS_ITEM_CUSTOMIZE_I18N.save, "Save")}
      </Button>
    </div>
  );

  const body = (
    <div
      className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-white [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
      data-vaul-no-drag=""
    >
      {optionsQuery.isLoading ? (
        <p className="p-6 text-center text-sm text-slate-500">
          {t(POS_ITEM_CUSTOMIZE_I18N.loading, "Loading…")}
        </p>
      ) : (
        <>
          {data && data.variants.length > 0 ? (
            <PosVariantSection
              title={t(POS_ITEM_CUSTOMIZE_I18N.variant, "Variant")}
              hint={t(POS_ITEM_CUSTOMIZE_I18N.pickOne, "Pick one")}
              selectedId={variantId}
              onSelect={setVariantId}
              options={data.variants.map((v) => ({
                id: v.id,
                label: v.name,
                disabled:
                  v.availableQty != null ? v.availableQty <= 0 : false,
              }))}
            />
          ) : null}

          {(data?.modifierGroups ?? []).map((g) => (
            <PosModifierGroupSection
              key={g.id}
              group={g}
              pickOneLabel={t(POS_ITEM_CUSTOMIZE_I18N.pickOne, "Pick one")}
              pickManyLabel={t(POS_ITEM_CUSTOMIZE_I18N.pickMany, "Pick many")}
              outOfStockLabel={t(
                POS_ITEM_CUSTOMIZE_I18N.optionOutOfStock,
                "Out of stock",
              )}
              selectedIds={modifierByGroup[g.id] ?? []}
              onToggle={(optionId) => toggleModifier(g.id, optionId)}
            />
          ))}

          <PosQtyStepper
            title={t(POS_ITEM_CUSTOMIZE_I18N.qty, "Quantity")}
            quantity={quantity}
            max={maxQty}
            onChange={setQuantity}
          />

          <PosLineDiscountSection
            title={t(POS_ITEM_CUSTOMIZE_I18N.discount, "Discount")}
            customAmountLabel={t(
              POS_ITEM_CUSTOMIZE_I18N.customAmount,
              "Custom amount",
            )}
            discounts={data?.discounts ?? []}
            selectedId={discountId}
            customAmount={customDiscountAmount}
            onSelect={setDiscountId}
            onCustomAmountChange={setCustomDiscountAmount}
          />

          {data?.useSalesTypePrices ? (
            <PosLineSalesTypeSection
              title={t(POS_ITEM_CUSTOMIZE_I18N.salesType, "Sales type")}
              hint={t(POS_ITEM_CUSTOMIZE_I18N.pickOne, "Pick one")}
              options={uniqueSalesTypes}
              selectedId={salesTypeId}
              onSelect={setSalesTypeId}
            />
          ) : null}
        </>
      )}
    </div>
  );

  const titleText = item.serviceName;

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} dismissible>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          className="z-[70] flex h-[min(92dvh,920px)] max-h-[min(92dvh,920px)] flex-col gap-0 overflow-hidden rounded-t-2xl border-0 p-0 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] shadow-2xl"
          overlayClassName="z-[70]"
        >
          {header(
            <DrawerTitle className="truncate text-base font-semibold text-slate-900">
              {titleText}
            </DrawerTitle>,
          )}
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[min(78dvh,720px)] w-[min(88vw,960px)] max-h-[min(78dvh,720px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        {header(
          <DialogTitle className="truncate text-base font-semibold text-slate-900">
            {titleText}
          </DialogTitle>,
        )}
        {body}
      </DialogContent>
    </Dialog>
  );
}
