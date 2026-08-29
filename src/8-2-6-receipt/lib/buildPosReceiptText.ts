import type { PosReceiptBranding, PosReceiptTransaction } from "./posReceipt.types";
import { formatCatalogCheckoutLineLabel } from "@/8-2-1-default-prices/checkout/lib/formatCatalogCheckoutLineLabel";

function formatReceiptRupiah(value: number): string {
  const n = Math.round(Number(value) || 0);
  return `Rp. ${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatQty(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
}

export function buildPosReceiptText(args: {
  branding: PosReceiptBranding;
  transaction: PosReceiptTransaction;
}): string {
  const { branding, transaction } = args;
  const lines = [
    branding.display.title || "Store",
    transaction.tableNumber ? `Meja ${transaction.tableNumber}` : null,
    transaction.receiptNumber ? `Receipt ${transaction.receiptNumber}` : "Store receipt",
    [transaction.dateLabel, transaction.timeLabel].filter(Boolean).join(" ") || null,
    transaction.clientName ?? null,
    transaction.ticketId ?? null,
    transaction.paymentMethod ? `Pay: ${transaction.paymentMethod}` : null,
    transaction.paymentReference ? `Ref: ${transaction.paymentReference}` : null,
    transaction.cashTendered != null ? `Cash received: ${formatReceiptRupiah(transaction.cashTendered)}` : null,
    transaction.change != null ? `Change: ${formatReceiptRupiah(transaction.change)}` : null,
    "",
    ...transaction.lineItems.map(
      (item) =>
        `${item.name}  ${formatQty(item.quantity)} × ${formatReceiptRupiah(item.unitPrice)}  ${formatReceiptRupiah(item.lineTotal)}`,
    ),
    "",
    `Subtotal ${formatReceiptRupiah(transaction.subtotal)}`,
    ...transaction.gratuityLines.map(
      (line) =>
        `${formatCatalogCheckoutLineLabel({ name: line.name, amountPercent: line.amount_percent })} ${formatReceiptRupiah(line.amount)}`,
    ),
    ...transaction.taxLines.map(
      (line) =>
        `${formatCatalogCheckoutLineLabel({ name: line.name, amountPercent: line.amount_percent })} ${formatReceiptRupiah(line.amount)}`,
    ),
    `Total ${formatReceiptRupiah(transaction.grandTotal)}`,
  ];
  if (branding.display.notes) {
    lines.push("", branding.display.notes);
  }
  return lines.filter((line) => line !== null).join("\n");
}

export { formatReceiptRupiah as formatPosReceiptRupiah };
