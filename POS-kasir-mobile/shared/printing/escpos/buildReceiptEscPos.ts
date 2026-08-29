import {
  encodeEscPosText,
  escPosColumns,
  escPosDivider,
} from "./encodeEscPosText";
import { formatCatalogCheckoutLineLabel } from "@/8-2-1-default-prices/checkout/lib/formatCatalogCheckoutLineLabel";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import { catalogItemLabel } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { lineTotal } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

export type PosReceiptPrintInput = {
  outletName: string;
  lines: CustomerVisitCartLine[];
  checkoutTotals: CatalogCheckoutTotals;
  customerName?: string | null;
  isBillDraft?: boolean;
};

function formatRp(amount: number): string {
  return `Rp${Math.round(amount).toLocaleString("id-ID")}`;
}

export function buildReceiptEscPos(input: PosReceiptPrintInput): Uint8Array {
  const width = 32;
  const rows: string[] = [];
  rows.push(input.outletName.slice(0, width));
  rows.push(input.isBillDraft ? "BILL" : "STRUK");
  rows.push(escPosDivider(width));
  if (input.customerName) {
    rows.push(`Pelanggan: ${input.customerName}`.slice(0, width));
  }
  for (const line of input.lines) {
    rows.push(catalogItemLabel(line).slice(0, width));
    rows.push(
      escPosColumns(
        `${line.quantity} x ${formatRp(line.unitPrice)}`,
        formatRp(lineTotal(line)),
        width,
      ),
    );
  }
  rows.push(escPosDivider(width));
  const { subtotal, gratuityLines, taxLines, grandTotal, applicationMethod } =
    input.checkoutTotals;
  rows.push(escPosColumns("Subtotal", formatRp(subtotal), width));
  for (const g of gratuityLines) {
    const label = formatCatalogCheckoutLineLabel({
      name: g.name,
      amountPercent: g.amount_percent,
      includedLabel: applicationMethod === "include" ? "inc" : null,
    });
    rows.push(escPosColumns(label.slice(0, 18), formatRp(g.amount), width));
  }
  for (const tax of taxLines) {
    const label = formatCatalogCheckoutLineLabel({
      name: tax.name,
      amountPercent: tax.amount_percent,
      includedLabel: applicationMethod === "include" ? "inc" : null,
    });
    rows.push(escPosColumns(label.slice(0, 18), formatRp(tax.amount), width));
  }
  rows.push(escPosColumns("TOTAL", formatRp(grandTotal), width));
  rows.push("");
  rows.push("Terima kasih");
  return encodeEscPosText(rows, { width });
}
