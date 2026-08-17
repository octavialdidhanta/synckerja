export function formatStoreReceiptNumber(activityId: string | null | undefined): string {
  const hex = String(activityId ?? '')
    .replace(/-/g, '')
    .slice(0, 8)
    .toUpperCase();
  return hex ? `SC-${hex}` : '';
}

export function formatStoreReceiptDateTime(args: {
  saleCreatedAt?: string | null;
  visitCreatedAt?: string | null;
  visitDate?: string | null;
}): string {
  const iso = args.saleCreatedAt || args.visitCreatedAt;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return `${date} ${time}`;
    }
  }
  if (args.visitDate) {
    try {
      return new Date(`${args.visitDate}T00:00:00`).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return args.visitDate;
    }
  }
  return '';
}

export function buildStoreReceiptText(args: {
  storeName?: string | null;
  receiptNumber: string;
  datetime?: string | null;
  clientName: string;
  ticketId?: string | null;
  payMethod: string;
  paymentReference?: string | null;
  cashReceived?: string | null;
  change?: string | null;
  tableNumber?: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: string; lineTotal: string }>;
  total: string;
}): string {
  const lines = [
    args.storeName?.trim() || 'Store',
    args.tableNumber ? `Meja ${args.tableNumber}` : null,
    args.receiptNumber ? `Receipt ${args.receiptNumber}` : 'Store receipt',
    args.datetime || null,
    args.clientName,
    args.ticketId ? args.ticketId : null,
    `Pay: ${args.payMethod}`,
    args.paymentReference ? `Ref: ${args.paymentReference}` : null,
    args.cashReceived ? `Cash received: ${args.cashReceived}` : null,
    args.change ? `Change: ${args.change}` : null,
    '',
    ...args.items.map((item) => `${item.name}  ${item.quantity} × ${item.unitPrice}  ${item.lineTotal}`),
    '',
    `Total ${args.total}`,
  ];
  return lines.filter((line) => line !== null).join('\n');
}
