import type { PosReceiptLineItem, PosReceiptTransaction } from "@/8-2-6-receipt/lib/posReceipt.types";
import type { InvoiceDetail } from "./invoicesTypes";
import { format, parseISO } from "date-fns";

function formatInvoiceDateTime(iso: string | null, ymd: string | null): { dateLabel: string; timeLabel: string } {
  if (iso) {
    try {
      const d = parseISO(iso);
      return { dateLabel: format(d, "dd MMM yyyy"), timeLabel: format(d, "HH:mm") };
    } catch {
      /* fall through */
    }
  }
  if (ymd) {
    try {
      const d = parseISO(ymd);
      return { dateLabel: format(d, "dd MMM yyyy"), timeLabel: "" };
    } catch {
      return { dateLabel: ymd, timeLabel: "" };
    }
  }
  return { dateLabel: "—", timeLabel: "" };
}

export function mapInvoiceDocumentTransaction(detail: InvoiceDetail): PosReceiptTransaction {
  const { dateLabel, timeLabel } = formatInvoiceDateTime(detail.createdAt, detail.invoiceIssuedAt?.slice(0, 10) ?? null);

  const lineItems: PosReceiptLineItem[] = detail.items.map((item) => ({
    id: item.id,
    name: item.subServiceName ? `${item.serviceName} · ${item.subServiceName}` : item.serviceName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.totalPrice,
  }));

  const subtotal = lineItems.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    dateLabel,
    timeLabel,
    receiptNumber: detail.invoiceNumber,
    clientName: detail.clientName,
    lineItems,
    subtotal: subtotal > 0 ? subtotal : detail.totalAmount,
    gratuityLines: [],
    taxLines: [],
    grandTotal: detail.totalAmount,
    globalDiscountLabel:
      detail.amountDue > 0 && detail.totalPaidAmount > 0 ? "Amount Due" : undefined,
    globalDiscountAmount:
      detail.amountDue > 0 && detail.totalPaidAmount > 0 ? detail.amountDue : undefined,
  };
}

export function invoiceDueBannerText(args: {
  displayStatus: string;
  invoiceDueDate: string | null;
  overdueDays: number | null;
  dueTodayLabel: string;
  overdueLabel: (days: number) => string;
  dueByLabel: (date: string) => string;
  paidLabel: string;
  cancelledLabel: string;
}): string | null {
  if (args.displayStatus === "cancelled") return args.cancelledLabel;
  if (args.displayStatus === "paid") return args.paidLabel;
  if (args.displayStatus === "overdue" && args.overdueDays != null) {
    return args.overdueLabel(args.overdueDays);
  }
  if (args.invoiceDueDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (args.invoiceDueDate === today) return args.dueTodayLabel;
    return args.dueByLabel(args.invoiceDueDate);
  }
  return null;
}
