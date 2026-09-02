import type {
  PublicOrderItemOptions,
  PublicOrderModifierGroup,
} from "@/synckerja-order/shared/lib/orderTypes";
import {
  isOptionQtyGroupValid,
  optionQtyValue,
  type OptionQtyById,
} from "./orderCustomizeOptionQty";

export type OrderCustomizeSelection = {
  variantId: string | null;
  selectedByGroup: Record<string, string[]>;
  qtyByGroup: Record<string, OptionQtyById>;
};

export function inStockVariantId(options: PublicOrderItemOptions): string | null {
  const available = options.variants.filter((v) => !v.out_of_stock);
  return (available[0] ?? options.variants[0])?.id ?? null;
}

export function defaultOrderCustomizeSelection(
  options: PublicOrderItemOptions,
): OrderCustomizeSelection {
  const selectedByGroup: Record<string, string[]> = {};
  const qtyByGroup: Record<string, OptionQtyById> = {};
  for (const group of options.modifier_groups) {
    if (group.option_qty_enabled) {
      selectedByGroup[group.id] = [];
      qtyByGroup[group.id] = {};
      continue;
    }
    if (group.is_required && group.max_selected === 1) {
      const pick = group.options.find((o) => !o.out_of_stock);
      selectedByGroup[group.id] = pick ? [pick.id] : [];
    } else {
      selectedByGroup[group.id] = [];
    }
  }
  return {
    variantId: inStockVariantId(options),
    selectedByGroup,
    qtyByGroup,
  };
}

export function isGroupSelectionValid(
  group: PublicOrderModifierGroup,
  selectedIds: string[],
  qtyByOption?: OptionQtyById,
): boolean {
  if (group.option_qty_enabled) {
    return isOptionQtyGroupValid(group, qtyByOption);
  }
  const count = selectedIds.length;
  return count >= group.min_selected && count <= group.max_selected;
}

export function isOrderCustomizeValid(
  options: PublicOrderItemOptions,
  selection: OrderCustomizeSelection,
): boolean {
  if (options.variants.length > 1 && !selection.variantId) return false;
  if (options.variants.length > 1) {
    const variant = options.variants.find((v) => v.id === selection.variantId);
    if (!variant || variant.out_of_stock) return false;
  }
  return options.modifier_groups.every((group) =>
    isGroupSelectionValid(
      group,
      selection.selectedByGroup[group.id] ?? [],
      selection.qtyByGroup[group.id],
    ),
  );
}

export function toggleOrderCustomizeOption(
  group: PublicOrderModifierGroup,
  selectedIds: string[],
  optionId: string,
  outOfStock: boolean,
): string[] {
  if (outOfStock) return selectedIds;
  const has = selectedIds.includes(optionId);
  if (group.single_select) {
    if (has) {
      return group.min_selected <= 0 ? [] : selectedIds;
    }
    return [optionId];
  }
  if (has) {
    const next = selectedIds.filter((id) => id !== optionId);
    if (next.length < group.min_selected) return selectedIds;
    return next;
  }
  if (selectedIds.length >= group.max_selected) return selectedIds;
  return [...selectedIds, optionId];
}

export function selectedModifierRows(
  options: PublicOrderItemOptions,
  selection: OrderCustomizeSelection,
): Array<{ optionId: string; name: string; extraPrice: number; quantity: number; groupName: string }> {
  const rows: Array<{
    optionId: string;
    name: string;
    extraPrice: number;
    quantity: number;
    groupName: string;
  }> = [];
  for (const group of options.modifier_groups) {
    if (group.option_qty_enabled) {
      const qtyMap = selection.qtyByGroup[group.id] ?? {};
      for (const opt of group.options) {
        const quantity = optionQtyValue(qtyMap, opt.id);
        if (quantity < 1) continue;
        rows.push({
          optionId: opt.id,
          name: opt.name,
          extraPrice: Math.max(0, Math.round(opt.extra_price || 0)),
          quantity,
          groupName: group.name,
        });
      }
      continue;
    }
    const ids = selection.selectedByGroup[group.id] ?? [];
    for (const id of ids) {
      const opt = group.options.find((o) => o.id === id);
      if (!opt) continue;
      rows.push({
        optionId: opt.id,
        name: opt.name,
        extraPrice: Math.max(0, Math.round(opt.extra_price || 0)),
        quantity: 1,
        groupName: group.name,
      });
    }
  }
  return rows;
}

export function orderCustomizeUnitPrice(
  options: PublicOrderItemOptions,
  selection: OrderCustomizeSelection,
): number {
  const variant = options.variants.find((v) => v.id === selection.variantId);
  const base = variant ? variant.price : options.unit_price;
  const extras = selectedModifierRows(options, selection).reduce(
    (sum, m) => sum + m.extraPrice * m.quantity,
    0,
  );
  return Math.max(0, Math.round(Number(base) || 0) + extras);
}

export function orderCustomizeLineTotal(
  options: PublicOrderItemOptions,
  selection: OrderCustomizeSelection,
  quantity: number,
): number {
  const qty = Math.max(1, Math.round(quantity || 1));
  return orderCustomizeUnitPrice(options, selection) * qty;
}

export function modifierDisplayName(name: string, quantity: number): string {
  const label = name.trim();
  if (!label) return "";
  return quantity > 1 ? `${label} ×${quantity}` : label;
}
