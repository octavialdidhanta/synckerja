import type { CustomerVisitSaleEmbed } from '@/5-2-customer-visits/lib/customerVisit.types';
import type { PosReceiptLineItem, PosReceiptTotalsLine, PosReceiptTransaction } from './posReceipt.types';

export type StoreCheckoutReceiptItem = {
  id: string;
  service_name: string;
  sub_service_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export function mapStoreCheckoutReceiptItems(items: StoreCheckoutReceiptItem[]): PosReceiptLineItem[] {
  return items.map((item) => ({
    id: item.id,
    name: item.sub_service_name ? `${item.service_name} · ${item.sub_service_name}` : item.service_name,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    lineTotal: item.total_price,
  }));
}

export function mapStoreCheckoutReceiptTransaction(args: {
  sale: CustomerVisitSaleEmbed | null;
  items: StoreCheckoutReceiptItem[];
  receiptNumber: string;
  datetime: string;
  clientName: string;
  ticketId?: string | null;
  tableNumber?: string | null;
  payMethod: string;
  paymentReference?: string | null;
  cashTendered?: number | null;
  change?: number | null;
  taxLines?: PosReceiptTotalsLine[];
  gratuityLines?: PosReceiptTotalsLine[];
}): PosReceiptTransaction {
  const [dateLabel, ...timeParts] = args.datetime.trim().split(/\s+/);
  const timeLabel = timeParts.join(" ") || "";
  const subtotal = Number(args.sale?.checkout_subtotal);
  const taxTotal = Number(args.sale?.checkout_tax_amount);
  const gratuityTotal = Number(args.sale?.checkout_gratuity_amount);
  const grandTotalRaw = Number(args.sale?.total_amount);
  const lineSubtotal = args.items.reduce((sum, item) => sum + Number(item.total_price), 0);
  const resolvedSubtotal =
    Number.isFinite(subtotal) && subtotal > 0 ? subtotal : lineSubtotal;
  const grandTotal =
    Number.isFinite(grandTotalRaw) && grandTotalRaw > 0 ? grandTotalRaw : resolvedSubtotal;

  return {
    dateLabel: dateLabel || args.datetime,
    timeLabel,
    receiptNumber: args.receiptNumber || undefined,
    tableNumber: args.tableNumber,
    clientName: args.clientName,
    ticketId: args.ticketId ?? undefined,
    lineItems: mapStoreCheckoutReceiptItems(args.items),
    subtotal: resolvedSubtotal,
    gratuityLines:
      args.gratuityLines ??
      (Number.isFinite(gratuityTotal) && gratuityTotal > 0
        ? [{ name: "Gratuity", amount: gratuityTotal }]
        : []),
    taxLines:
      args.taxLines ??
      (Number.isFinite(taxTotal) && taxTotal > 0 ? [{ name: "Tax", amount: taxTotal }] : []),
    grandTotal,
    paymentMethod: args.payMethod,
    paymentReference: args.paymentReference,
    cashTendered: args.cashTendered,
    change: args.change,
  };
}
