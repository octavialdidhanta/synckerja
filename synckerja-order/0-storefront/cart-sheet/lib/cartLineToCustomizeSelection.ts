import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { PublicOrderItemOptions, PublicOrderModifierGroup } from "@/synckerja-order/shared/lib/orderTypes";
import type { OptionQtyById } from "../../customize/lib/orderCustomizeOptionQty";
import {
  defaultOrderCustomizeSelection,
  type OrderCustomizeSelection,
} from "../../customize/lib/orderCustomizeSelection";

function cloneQtyMap(qtyByGroup: Record<string, OptionQtyById>): Record<string, OptionQtyById> {
  const next: Record<string, OptionQtyById> = {};
  for (const [groupId, qty] of Object.entries(qtyByGroup)) {
    next[groupId] = { ...qty };
  }
  return next;
}

function groupByOptionId(options: PublicOrderItemOptions): Map<string, PublicOrderModifierGroup> {
  const map = new Map<string, PublicOrderModifierGroup>();
  for (const group of options.modifier_groups) {
    for (const option of group.options) {
      map.set(option.id, group);
    }
  }
  return map;
}

/** Hydrate overlay selection + notes from an existing cart line once item options have loaded. */
export function cartLineToCustomizeSelection(
  options: PublicOrderItemOptions,
  line: Pick<CustomerVisitCartLine, "variantId" | "modifiers" | "kitchenNote">,
): { selection: OrderCustomizeSelection; kitchenNote: string } {
  const base = defaultOrderCustomizeSelection(options);
  const selectedByGroup: Record<string, string[]> = {};
  for (const [groupId, ids] of Object.entries(base.selectedByGroup)) {
    selectedByGroup[groupId] = [...ids];
  }
  const qtyByGroup = cloneQtyMap(base.qtyByGroup);
  const variantOk = Boolean(
    line.variantId && options.variants.some((variant) => variant.id === line.variantId),
  );

  const byOption = groupByOptionId(options);
  const replacedToggle = new Set<string>();
  const replacedQty = new Set<string>();
  for (const modifier of line.modifiers ?? []) {
    const group = byOption.get(modifier.optionId);
    if (!group) continue;
    if (group.option_qty_enabled) {
      if (!replacedQty.has(group.id)) {
        qtyByGroup[group.id] = {};
        replacedQty.add(group.id);
      }
      const quantity = Math.max(1, Math.round(Number(modifier.quantity) || 1));
      qtyByGroup[group.id] = { ...(qtyByGroup[group.id] ?? {}), [modifier.optionId]: quantity };
      continue;
    }
    if (!replacedToggle.has(group.id)) {
      selectedByGroup[group.id] = [];
      replacedToggle.add(group.id);
    }
    const current = selectedByGroup[group.id] ?? [];
    if (!current.includes(modifier.optionId)) {
      selectedByGroup[group.id] = [...current, modifier.optionId];
    }
  }

  return {
    selection: {
      variantId: variantOk ? line.variantId ?? null : base.variantId,
      selectedByGroup,
      qtyByGroup,
    },
    kitchenNote: (line.kitchenNote ?? "").trim(),
  };
}
