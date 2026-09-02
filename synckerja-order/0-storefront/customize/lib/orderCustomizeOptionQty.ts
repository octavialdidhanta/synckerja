import type { PublicOrderModifierGroup } from "@/synckerja-order/shared/lib/orderTypes";

export type OptionQtyById = Record<string, number>;

export function optionQtyValue(qtyByOption: OptionQtyById | undefined, optionId: string): number {
  return Math.max(0, Math.round(Number(qtyByOption?.[optionId]) || 0));
}

export function sumOptionQty(qtyByOption: OptionQtyById | undefined): number {
  if (!qtyByOption) return 0;
  return Object.values(qtyByOption).reduce((sum, n) => sum + Math.max(0, Math.round(Number(n) || 0)), 0);
}

export function isOptionQtyGroupValid(group: PublicOrderModifierGroup, qtyByOption: OptionQtyById | undefined): boolean {
  const total = sumOptionQty(qtyByOption);
  return total >= group.min_selected && total <= group.max_selected;
}

export function bumpOptionQty(args: {
  group: PublicOrderModifierGroup;
  qtyByOption: OptionQtyById | undefined;
  optionId: string;
  delta: number;
  outOfStock: boolean;
}): OptionQtyById {
  const current = { ...(args.qtyByOption ?? {}) };
  const prev = optionQtyValue(current, args.optionId);
  if (args.outOfStock && args.delta > 0) return current;
  const nextRaw = prev + args.delta;
  if (nextRaw <= 0) {
    const { [args.optionId]: _, ...rest } = current;
    return rest;
  }
  const others = sumOptionQty(current) - prev;
  const max = Math.max(1, args.group.max_selected);
  const next = Math.min(nextRaw, Math.max(0, max - others));
  if (next <= 0) {
    const { [args.optionId]: _, ...rest } = current;
    return rest;
  }
  return { ...current, [args.optionId]: next };
}

export function canIncreaseOptionQty(args: {
  group: PublicOrderModifierGroup;
  qtyByOption: OptionQtyById | undefined;
  outOfStock: boolean;
}): boolean {
  if (args.outOfStock) return false;
  return sumOptionQty(args.qtyByOption) < Math.max(1, args.group.max_selected);
}
