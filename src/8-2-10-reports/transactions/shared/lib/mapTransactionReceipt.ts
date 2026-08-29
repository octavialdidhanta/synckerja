import type { PosReceiptLineItem, PosReceiptTotalsLine, PosReceiptTransaction } from "@/8-2-6-receipt/lib/posReceipt.types";

export type TransactionReceiptItem = {
  id: string;
  serviceName: string;
  subServiceName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type TransactionReceiptModifier = {
  salesActivityItemId: string | null;
  optionName: string;
  extraPrice: number;
  quantity: number;
};

export type TransactionReceiptLineDiscount = {
  salesActivityItemId: string | null;
  discountName: string;
  amountRp: number;
};

export type TransactionReceiptDetail = {
  salesActivityId: string;
  posOutletId: string | null;
  clientName: string;
  clientPhone: string | null;
  date: string | null;
  createdAt: string | null;
  totalAmount: number;
  totalPaidAmount: number | null;
  checkoutSubtotal: number | null;
  checkoutTaxAmount: number | null;
  checkoutGratuityAmount: number | null;
  checkoutDiscountAmount: number | null;
  checkoutDiscountLabel: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  cashTendered: number | null;
  tableNumber: string | null;
  catalogSalesTypeId: string | null;
  servedByName: string | null;
  collectedByName: string | null;
  items: TransactionReceiptItem[];
  modifiers: TransactionReceiptModifier[];
  lineDiscounts: TransactionReceiptLineDiscount[];
  taxLines: PosReceiptTotalsLine[];
  gratuityLines: PosReceiptTotalsLine[];
};

function itemDisplayName(item: TransactionReceiptItem): string {
  return item.subServiceName
    ? `${item.serviceName} · ${item.subServiceName}`
    : item.serviceName;
}

export function mapTransactionToPosReceiptTransaction(args: {
  detail: TransactionReceiptDetail;
  receiptNumber: string;
  datetime: string;
  payMethodLabel: string;
  change?: number | null;
}): PosReceiptTransaction {
  const { detail } = args;
  const [dateLabel, ...timeParts] = args.datetime.trim().split(/\s+/);
  const timeLabel = timeParts.join(" ") || "";

  const modifiersByItem = new Map<string, TransactionReceiptModifier[]>();
  for (const mod of detail.modifiers) {
    if (!mod.salesActivityItemId) continue;
    const list = modifiersByItem.get(mod.salesActivityItemId) ?? [];
    list.push(mod);
    modifiersByItem.set(mod.salesActivityItemId, list);
  }

  const discountsByItem = new Map<string, TransactionReceiptLineDiscount>();
  for (const disc of detail.lineDiscounts) {
    if (!disc.salesActivityItemId) continue;
    discountsByItem.set(disc.salesActivityItemId, disc);
  }

  const lineItems: PosReceiptLineItem[] = detail.items.map((item) => {
    const mods = modifiersByItem.get(item.id) ?? [];
    const lineDiscount = discountsByItem.get(item.id);
    return {
      id: item.id,
      name: itemDisplayName(item),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.totalPrice,
      modifiers: mods.map((m) => ({
        label: m.optionName,
        price: m.extraPrice > 0 ? m.extraPrice : undefined,
      })),
      promoLabel: lineDiscount?.discountName,
      promoAmount: lineDiscount && lineDiscount.amountRp > 0 ? lineDiscount.amountRp : undefined,
    };
  });

  const subtotalRaw = Number(detail.checkoutSubtotal);
  const lineSubtotal = detail.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const resolvedSubtotal =
    Number.isFinite(subtotalRaw) && subtotalRaw > 0 ? subtotalRaw : lineSubtotal;

  const grandTotalRaw = Number(detail.totalPaidAmount ?? detail.totalAmount);
  const grandTotal =
    Number.isFinite(grandTotalRaw) && grandTotalRaw > 0 ? grandTotalRaw : resolvedSubtotal;

  const globalDiscount = Math.max(0, Number(detail.checkoutDiscountAmount) || 0);

  return {
    dateLabel: dateLabel || args.datetime,
    timeLabel,
    receiptNumber: args.receiptNumber || undefined,
    servedBy: detail.servedByName ?? undefined,
    collectedBy: detail.collectedByName ?? undefined,
    tableNumber: detail.tableNumber,
    clientName: detail.clientName,
    lineItems,
    globalDiscountLabel:
      globalDiscount > 0 ? detail.checkoutDiscountLabel ?? "Discount" : undefined,
    globalDiscountAmount: globalDiscount > 0 ? globalDiscount : undefined,
    subtotal: resolvedSubtotal,
    gratuityLines:
      detail.gratuityLines.length > 0
        ? detail.gratuityLines
        : (() => {
            const g = Number(detail.checkoutGratuityAmount);
            return Number.isFinite(g) && g > 0 ? [{ name: "Gratuity", amount: g }] : [];
          })(),
    taxLines:
      detail.taxLines.length > 0
        ? detail.taxLines
        : (() => {
            const t = Number(detail.checkoutTaxAmount);
            return Number.isFinite(t) && t > 0 ? [{ name: "Tax", amount: t }] : [];
          })(),
    grandTotal,
    paymentMethod: args.payMethodLabel,
    paymentReference: detail.paymentReference,
    cashTendered: detail.cashTendered,
    change: args.change ?? null,
  };
}
