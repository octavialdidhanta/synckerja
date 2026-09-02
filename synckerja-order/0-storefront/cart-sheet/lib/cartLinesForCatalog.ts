import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

/** Cart lines for one catalog item, newest (last-in) first. */
export function cartLinesForCatalog(
  lines: CustomerVisitCartLine[],
  catalogId: string,
): CustomerVisitCartLine[] {
  const matching: CustomerVisitCartLine[] = [];
  for (const line of lines) {
    if (line.catalogId === catalogId) matching.push(line);
  }
  matching.reverse();
  return matching;
}
