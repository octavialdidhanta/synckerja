import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { lineTotal } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import { formatPosCash } from "@/pos-mobile/4-shift/lib/formatPosCash";

export const POS_CUSTOM_AMOUNT_MAX_DIGITS = 12;
export const POS_CUSTOM_DESCRIPTION_MIN_LEN = 3;

export function isPosCustomCartLine(line: CustomerVisitCartLine): boolean {
  return Boolean(line.isCustomAmount) || line.catalogId.startsWith("custom:");
}

export function splitPosCartLines(lines: CustomerVisitCartLine[]): {
  catalogLines: CustomerVisitCartLine[];
  customLines: CustomerVisitCartLine[];
  customTotal: number;
} {
  const catalogLines: CustomerVisitCartLine[] = [];
  const customLines: CustomerVisitCartLine[] = [];
  let customTotal = 0;
  for (const line of lines) {
    if (isPosCustomCartLine(line)) {
      customLines.push(line);
      customTotal += lineTotal(line);
    } else {
      catalogLines.push(line);
    }
  }
  return { catalogLines, customLines, customTotal };
}

/** Merge taxed catalog totals with untaxed custom amounts for bill display / pay. */
export function mergePosCheckoutTotalsWithCustom(
  priced: CatalogCheckoutTotals,
  customTotal: number,
): CatalogCheckoutTotals {
  const custom = Math.max(0, Math.round(customTotal));
  return {
    ...priced,
    subtotal: priced.subtotal + custom,
    grandTotal: priced.grandTotal + custom,
  };
}

export function appendPosCustomKeypadDigit(digits: string, key: string): string {
  if (key === "C") return "";
  if (key === "Del") return digits.slice(0, -1);
  if (key === "00") {
    if (!digits || digits === "0") return digits || "0";
    return (digits + "00").slice(0, POS_CUSTOM_AMOUNT_MAX_DIGITS);
  }
  if (!/^\d$/.test(key)) return digits;
  if (!digits || digits === "0") return key === "0" ? "0" : key;
  return (digits + key).slice(0, POS_CUSTOM_AMOUNT_MAX_DIGITS);
}

export function parsePosCustomKeypadDigits(digits: string): number {
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

export function formatPosCustomKeypadDisplay(digits: string): string {
  return formatPosCash(parsePosCustomKeypadDigits(digits));
}

export function createCustomCartLine(args: {
  amount: number;
  label: string;
}): CustomerVisitCartLine | null {
  const amount = Math.round(Number(args.amount));
  const label = args.label.trim();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (label.length < POS_CUSTOM_DESCRIPTION_MIN_LEN) return null;
  const catalogId = `custom:${crypto.randomUUID()}`;
  return {
    catalogId,
    lineKey: catalogId,
    kind: "service",
    serviceId: null,
    subServiceId: null,
    serviceName: label,
    subServiceName: null,
    quantity: 1,
    unitPrice: amount,
    photoUrl: null,
    unit: null,
    trackStock: false,
    inventorySkuId: null,
    availableQty: null,
    productCategoryId: null,
    productCategoryName: null,
    isCustomAmount: true,
  };
}
