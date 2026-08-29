export type InvoiceDisplayStatus =
  | "unpaid"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled";

export function computeInvoiceDisplayStatus(args: {
  invoiceCancelledAt: string | null;
  invoiceDueDate: string | null;
  paymentStatus: string | null;
  totalAmount: number;
  totalPaidAmount: number;
  today?: Date;
}): InvoiceDisplayStatus {
  const today = args.today ?? new Date();
  const todayYmd = today.toISOString().slice(0, 10);
  const total = Math.max(0, Number(args.totalAmount) || 0);
  const paid = Math.max(0, Number(args.totalPaidAmount) || 0);

  if (args.invoiceCancelledAt) return "cancelled";
  if (total <= 0) return "unpaid";
  if (paid >= total) return "paid";

  const isPastDue =
    Boolean(args.invoiceDueDate) && args.invoiceDueDate! < todayYmd;

  if (paid > 0) return isPastDue ? "overdue" : "partial";
  if (isPastDue) return "overdue";

  const ps = (args.paymentStatus ?? "").trim().toLowerCase();
  if (ps === "partial") return "partial";
  if (ps === "paid") return "paid";
  return "unpaid";
}

export function computeOverdueDays(
  invoiceDueDate: string | null,
  invoiceCancelledAt: string | null,
  asOf?: Date,
): number | null {
  if (invoiceCancelledAt || !invoiceDueDate) return null;
  const today = asOf ?? new Date();
  const due = new Date(`${invoiceDueDate}T00:00:00`);
  const now = new Date(`${today.toISOString().slice(0, 10)}T00:00:00`);
  const diff = Math.floor((now.getTime() - due.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}
