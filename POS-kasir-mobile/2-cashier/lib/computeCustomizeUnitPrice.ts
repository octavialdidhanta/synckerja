import type {
  CustomerVisitCartLine,
  CustomerVisitCartModifier,
} from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

export type CustomizePriceInput = {
  baseUnitPrice: number;
  modifiers: Pick<CustomerVisitCartModifier, "extraPrice">[];
  /** Absolute Rp discount applied to the whole line (before qty multiply on unit). */
  lineDiscountAmountRp?: number;
  quantity: number;
};

/**
 * Unit price after modifiers; line discount is spread per unit so qty * unitPrice stays correct.
 * Returns final per-unit price (floored at 0).
 */
export function computeCustomizeUnitPrice(input: CustomizePriceInput): number {
  const extras = input.modifiers.reduce(
    (sum, m) => sum + Math.max(0, Math.round(Number(m.extraPrice) || 0)),
    0,
  );
  const base = Math.max(0, Math.round(Number(input.baseUnitPrice) || 0)) + extras;
  const qty = Math.max(1, Math.round(Number(input.quantity) || 1));
  const discountTotal = Math.max(0, Math.round(Number(input.lineDiscountAmountRp) || 0));
  const discountPerUnit = Math.floor(discountTotal / qty);
  return Math.max(0, base - discountPerUnit);
}

export function computeCustomizeLineTotal(input: CustomizePriceInput): number {
  const qty = Math.max(1, Math.round(Number(input.quantity) || 1));
  return computeCustomizeUnitPrice(input) * qty;
}

/** Build display name bits for kitchen / receipt. */
export function buildCustomizeSubServiceName(args: {
  unit: string | null;
  variantName?: string | null;
  modifiers?: { name: string }[];
  lineSalesTypeLabel?: string | null;
}): string | null {
  const parts: string[] = [];
  if (args.variantName?.trim()) parts.push(args.variantName.trim());
  for (const m of args.modifiers ?? []) {
    if (m.name.trim()) parts.push(m.name.trim());
  }
  if (args.lineSalesTypeLabel?.trim()) parts.push(args.lineSalesTypeLabel.trim());
  if (parts.length === 0) return args.unit;
  return parts.join(" · ");
}

export function assertCustomizeLine(line: CustomerVisitCartLine): CustomerVisitCartLine {
  return line;
}
