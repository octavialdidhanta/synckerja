import type { PurchaseOrderStatus } from "../types";
import {
  canCancelPurchaseOrder,
  canEditPurchaseOrder,
  canFulfillPurchaseOrder,
  canResubmitPurchaseOrder,
  derivePoFinanceStatus,
  poFinanceHref,
  type PoFinanceStatus,
  type PoLinkedPurchaseRequest,
} from "./poFinanceStatus";

export function usePurchaseOrderFinance(args: {
  poStatus: PurchaseOrderStatus | string | undefined;
  linkedRequest: PoLinkedPurchaseRequest | null | undefined;
}) {
  const financeStatus: PoFinanceStatus = derivePoFinanceStatus(args.linkedRequest);
  const poStatus = args.poStatus ?? "waiting";
  const hasLinkedRequest = Boolean(args.linkedRequest?.id);

  return {
    financeStatus,
    hasLinkedRequest,
    href: poFinanceHref(financeStatus),
    canFulfill: canFulfillPurchaseOrder(poStatus, financeStatus, hasLinkedRequest),
    canCancel: canCancelPurchaseOrder(poStatus, financeStatus),
    canEdit: canEditPurchaseOrder(poStatus, financeStatus),
    canResubmit: canResubmitPurchaseOrder(poStatus, financeStatus),
  };
}
