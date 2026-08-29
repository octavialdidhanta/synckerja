import type { InvoiceDisplayStatus } from "./computeInvoiceDisplayStatus";

export type InvoiceRow = {
  activityId: string;
  invoiceNumber: string;
  createdAt: string;
  invoiceDueDate: string | null;
  outletId: string | null;
  outletName: string;
  clientName: string;
  displayStatus: InvoiceDisplayStatus;
  overdueDays: number | null;
  totalAmount: number;
  totalPaidAmount: number;
  amountDue: number;
  itemSummary: string;
};

export type InvoicesSummary = {
  count: number;
  unpaid: number;
  partial: number;
  paid: number;
  overdue: number;
  cancelled: number;
};

export type InvoiceDetailItem = {
  id: string;
  serviceName: string;
  subServiceName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type InvoicePaymentRow = {
  id: string;
  paymentAmount: number;
  paymentDate: string;
  paymentMethod: string | null;
  paymentType: string | null;
  paymentSequence: number | null;
  notes: string | null;
};

export type InvoiceDetail = {
  activityId: string;
  invoiceNumber: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  createdAt: string | null;
  invoiceDueDate: string | null;
  invoiceIssuedAt: string | null;
  invoiceCancelledAt: string | null;
  invoiceCancelReason: string | null;
  posOutletId: string | null;
  activityType: string | null;
  displayStatus: InvoiceDisplayStatus;
  overdueDays: number | null;
  totalAmount: number;
  totalPaidAmount: number;
  amountDue: number;
  description: string | null;
  items: InvoiceDetailItem[];
  payments: InvoicePaymentRow[];
};
