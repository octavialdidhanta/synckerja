import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

/** Split cart by lineKey → qty to move into the paid portion. */
export function splitCartLinesByQty(
  lines: CustomerVisitCartLine[],
  splitQtyByLineKey: Map<string, number>,
): { splitLines: CustomerVisitCartLine[]; remainderLines: CustomerVisitCartLine[] } {
  const splitLines: CustomerVisitCartLine[] = [];
  const remainderLines: CustomerVisitCartLine[] = [];

  for (const line of lines) {
    const raw = splitQtyByLineKey.get(line.lineKey) ?? 0;
    const splitQty = Math.min(line.quantity, Math.max(0, Math.floor(raw)));
    if (splitQty <= 0) {
      remainderLines.push(line);
      continue;
    }
    if (splitQty >= line.quantity) {
      splitLines.push(line);
      continue;
    }
    splitLines.push({ ...line, quantity: splitQty });
    remainderLines.push({ ...line, quantity: line.quantity - splitQty });
  }

  return { splitLines, remainderLines };
}

/** Full-bill selection keyed by lineKey (required by splitCartLinesByQty). */
export function buildFullCartSelection(
  lines: CustomerVisitCartLine[],
): Map<string, number> {
  const selection = new Map<string, number>();
  for (const line of lines) {
    selection.set(line.lineKey, line.quantity);
  }
  return selection;
}

export function hasAnySplitSelection(splitQtyByLineKey: Map<string, number>): boolean {
  for (const qty of splitQtyByLineKey.values()) {
    if (qty > 0) return true;
  }
  return false;
}
