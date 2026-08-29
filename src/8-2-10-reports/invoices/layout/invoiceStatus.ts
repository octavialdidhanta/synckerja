import type { InvoiceDisplayStatus } from "../shared/lib/computeInvoiceDisplayStatus";

export type InvoiceStatusFilter = InvoiceDisplayStatus | "all";

export const INVOICE_STATUS_FILTER_IDS: InvoiceStatusFilter[] = [
  "all",
  "unpaid",
  "partial",
  "paid",
  "overdue",
  "cancelled",
];

export function parseInvoiceStatusFilter(raw: string | null): InvoiceStatusFilter {
  if (
    raw === "unpaid" ||
    raw === "partial" ||
    raw === "paid" ||
    raw === "overdue" ||
    raw === "cancelled"
  ) {
    return raw;
  }
  return "all";
}

export function invoiceStatusLabelKey(status: InvoiceDisplayStatus | "all"): string {
  if (status === "all") return "reports.invoices.status.all";
  return `reports.invoices.status.${status}`;
}
