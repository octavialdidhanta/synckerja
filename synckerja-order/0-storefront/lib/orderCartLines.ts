import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

export function mergeCustomizedCartLine(
  lines: CustomerVisitCartLine[],
  incoming: CustomerVisitCartLine,
): CustomerVisitCartLine[] {
  const key = incoming.lineKey;
  const existing = lines.find((l) => l.lineKey === key);
  if (!existing) return [...lines, incoming];
  return lines.map((l) =>
    l.lineKey === key ? { ...l, quantity: l.quantity + incoming.quantity } : l,
  );
}

/** Replace one line; keep its qty. If the new fingerprint matches another line, merge qty. */
export function replaceCartLine(
  lines: CustomerVisitCartLine[],
  oldKey: string,
  next: CustomerVisitCartLine,
): CustomerVisitCartLine[] {
  const old = lines.find((l) => l.lineKey === oldKey);
  if (!old) return mergeCustomizedCartLine(lines, next);
  const incoming: CustomerVisitCartLine = { ...next, quantity: old.quantity };
  const without = lines.filter((l) => l.lineKey !== oldKey);
  return mergeCustomizedCartLine(without, incoming);
}

function lastIndexForCatalogId(lines: CustomerVisitCartLine[], catalogId: string): number {
  let lastIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]?.catalogId === catalogId) lastIndex = i;
  }
  return lastIndex;
}

/** Increase qty on the last matching catalog line (most recently added). */
export function bumpLastLineForCatalogId(
  lines: CustomerVisitCartLine[],
  catalogId: string,
): CustomerVisitCartLine[] {
  const lastIndex = lastIndexForCatalogId(lines, catalogId);
  if (lastIndex < 0) return lines;
  return lines.map((l, i) => (i === lastIndex ? { ...l, quantity: l.quantity + 1 } : l));
}

/** Decrease qty on the last matching catalog line (most recently added). */
export function removeLastLineForCatalogId(
  lines: CustomerVisitCartLine[],
  catalogId: string,
): CustomerVisitCartLine[] {
  const lastIndex = lastIndexForCatalogId(lines, catalogId);
  if (lastIndex < 0) return lines;
  const line = lines[lastIndex];
  if (!line) return lines;
  if (line.quantity <= 1) return lines.filter((_, i) => i !== lastIndex);
  return lines.map((l, i) => (i === lastIndex ? { ...l, quantity: l.quantity - 1 } : l));
}
