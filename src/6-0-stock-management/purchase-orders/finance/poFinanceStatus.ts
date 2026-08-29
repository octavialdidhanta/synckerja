export type PoFinanceStatus =
  | "none"
  | "submitted"
  | "approved"
  | "paid"
  | "rejected"
  | "cancelled";

export type PoLinkedPurchaseRequest = {
  id: string;
  status: string;
  payment_status?: string | null;
  paid_at?: string | null;
};

export function isPoFinancePaid(pr: PoLinkedPurchaseRequest | null | undefined): boolean {
  if (!pr) return false;
  return Boolean(pr.paid_at) || String(pr.payment_status ?? "").toLowerCase() === "paid";
}

export function derivePoFinanceStatus(
  pr: PoLinkedPurchaseRequest | null | undefined,
): PoFinanceStatus {
  if (!pr) return "none";
  if (isPoFinancePaid(pr)) return "paid";
  if (pr.status === "cancelled") return "cancelled";
  if (pr.status === "rejected") return "rejected";
  if (pr.status === "approved") return "approved";
  if (pr.status === "submitted" || pr.status === "pending_approval") return "submitted";
  return "none";
}

export function canFulfillPurchaseOrder(
  poStatus: string,
  financeStatus: PoFinanceStatus,
  hasLinkedRequest: boolean,
): boolean {
  if (poStatus !== "waiting") return false;
  if (!hasLinkedRequest) return true;
  return financeStatus === "paid";
}

export function canCancelPurchaseOrder(poStatus: string, financeStatus: PoFinanceStatus): boolean {
  return poStatus === "waiting" && financeStatus !== "paid";
}

export function canEditPurchaseOrder(poStatus: string, financeStatus: PoFinanceStatus): boolean {
  return poStatus === "waiting" && financeStatus !== "paid" && financeStatus !== "approved";
}

export function canResubmitPurchaseOrder(poStatus: string, financeStatus: PoFinanceStatus): boolean {
  return poStatus === "waiting" && financeStatus === "rejected";
}

export function poFinanceHref(financeStatus: PoFinanceStatus): string | null {
  if (financeStatus === "submitted" || financeStatus === "rejected") return "/expenses/approvals";
  if (financeStatus === "approved" || financeStatus === "paid") return "/expenses/payment-process";
  return null;
}
