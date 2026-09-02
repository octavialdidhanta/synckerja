import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

export type CartLineSummaryIncluded = {
  name: string;
  quantity: number;
};

function summaryRow(qty: number, name: string): string | null {
  const label = name.trim();
  if (!label) return null;
  return `x${Math.max(1, Math.round(qty || 1))} ${label}`;
}

/** Display rows like `x2 Lemon Tea - Iced` from variant, modifiers, and optional bundle includes. */
export function formatCartLineSummary(
  line: Pick<CustomerVisitCartLine, "kind" | "serviceName" | "quantity" | "variantName" | "modifiers">,
  includedItems?: CartLineSummaryIncluded[],
): string[] {
  const rows: string[] = [];
  const variant = summaryRow(1, line.variantName ?? "");
  if (variant) rows.push(variant);
  for (const modifier of line.modifiers ?? []) {
    const row = summaryRow(modifier.quantity ?? 1, modifier.name);
    if (row) rows.push(row);
  }
  if (line.kind === "bundle") {
    for (const item of includedItems ?? []) {
      const row = summaryRow(item.quantity, item.name);
      if (row) rows.push(row);
    }
  }
  if (rows.length === 0) {
    const fallback = summaryRow(line.quantity, line.serviceName);
    if (fallback) rows.push(fallback);
  }
  return rows;
}
