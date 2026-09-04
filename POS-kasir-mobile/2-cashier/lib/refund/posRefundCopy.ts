import type { RefundStockPolicy } from "./resolveRefundStockPolicy";

/** Shared refund confirm copy (Activity, cashier bill list, table map). */
export const POS_REFUND_I18N = {
  confirmTitle: "posCashier.refund.confirmTitle",
  confirmDescRestore: "posCashier.refund.confirmDescRestore",
  confirmDescWaste: "posCashier.refund.confirmDescWaste",
  reasonLabel: "posCashier.refund.reasonLabel",
  reasonLabelRestore: "posCashier.refund.reasonLabelRestore",
  reasonLabelWaste: "posCashier.refund.reasonLabelWaste",
  reasonPlaceholder: "posCashier.refund.reasonPlaceholder",
  reasonRequired: "posCashier.refund.reasonRequired",
  policyLoading: "posCashier.refund.policyLoading",
  cancel: "posCashier.refund.cancel",
  confirm: "posCashier.refund.confirm",
  successRestore: "posCashier.refund.successRestore",
  successWaste: "posCashier.refund.successWaste",
  kitchenVoidWarning: "posCashier.refund.kitchenVoidWarning",
  wasteReasonRequired: "posCashier.refund.wasteReasonRequired",
  policyChangedNeedReason: "posCashier.refund.policyChangedNeedReason",
} as const;

export function posRefundSuccessTitleKey(policy: RefundStockPolicy) {
  return policy === "waste"
    ? POS_REFUND_I18N.successWaste
    : POS_REFUND_I18N.successRestore;
}
