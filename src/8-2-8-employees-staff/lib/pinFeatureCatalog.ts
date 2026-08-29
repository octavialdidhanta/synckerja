export type PosPinFeatureKey =
  | "pin.feature.print_bill"
  | "pin.feature.manage_open_bills"
  | "pin.feature.apply_discounts"
  | "pin.feature.manage_discounts"
  | "pin.feature.issue_refunds"
  | "pin.feature.resend_receipts"
  | "pin.feature.record_invoice_payments"
  | "pin.feature.cancel_invoices"
  | "pin.feature.view_shift_history"
  | "pin.feature.edit_customer_information"
  | "pin.feature.view_activity"
  | "pin.feature.cash_drawer";

export type PosPinFeatureDef = {
  key: PosPinFeatureKey;
  labelKey: string;
  labelFallback: string;
  descriptionKey?: string;
  descriptionFallback?: string;
  /** Shown in Office checklist (cash_drawer kept for legacy sync only). */
  showInChecklist: boolean;
};

/** Features configurable on PIN Access (Moka-like list). */
export const POS_PIN_FEATURE_CATALOG: readonly PosPinFeatureDef[] = [
  {
    key: "pin.feature.print_bill",
    labelKey: "employeesStaff.pinAccess.feature.printBill",
    labelFallback: "Print Bill",
    showInChecklist: true,
  },
  {
    key: "pin.feature.manage_open_bills",
    labelKey: "employeesStaff.pinAccess.feature.openBills",
    labelFallback: "Manage All Open Bills",
    descriptionKey: "employeesStaff.pinAccess.feature.openBillsHint",
    descriptionFallback: "Required to complete transactions",
    showInChecklist: true,
  },
  {
    key: "pin.feature.apply_discounts",
    labelKey: "employeesStaff.pinAccess.feature.applyDiscounts",
    labelFallback: "Apply Discounts to Bills and Items",
    showInChecklist: true,
  },
  {
    key: "pin.feature.manage_discounts",
    labelKey: "employeesStaff.pinAccess.feature.manageDiscounts",
    labelFallback: "Manage Discounts",
    showInChecklist: true,
  },
  {
    key: "pin.feature.issue_refunds",
    labelKey: "employeesStaff.pinAccess.feature.refunds",
    labelFallback: "Issue Refunds",
    showInChecklist: true,
  },
  {
    key: "pin.feature.resend_receipts",
    labelKey: "employeesStaff.pinAccess.feature.resendReceipts",
    labelFallback: "Resend Receipts",
    showInChecklist: true,
  },
  {
    key: "pin.feature.record_invoice_payments",
    labelKey: "employeesStaff.pinAccess.feature.recordPayments",
    labelFallback: "Record Invoice Payments",
    showInChecklist: true,
  },
  {
    key: "pin.feature.cancel_invoices",
    labelKey: "employeesStaff.pinAccess.feature.cancelInvoices",
    labelFallback: "Cancel Invoices",
    showInChecklist: true,
  },
  {
    key: "pin.feature.view_shift_history",
    labelKey: "employeesStaff.pinAccess.feature.shiftHistory",
    labelFallback: "View Shift History",
    showInChecklist: true,
  },
  {
    key: "pin.feature.edit_customer_information",
    labelKey: "employeesStaff.pinAccess.feature.editCustomer",
    labelFallback: "Edit Customer Information",
    showInChecklist: true,
  },
  {
    key: "pin.feature.view_activity",
    labelKey: "employeesStaff.pinAccess.feature.viewActivity",
    labelFallback: "View Activity",
    showInChecklist: true,
  },
  {
    key: "pin.feature.cash_drawer",
    labelKey: "employeesStaff.pinAccess.feature.cashDrawer",
    labelFallback: "Open Cash Drawer",
    showInChecklist: false,
  },
] as const;

export const POS_PIN_CHECKLIST_FEATURES = POS_PIN_FEATURE_CATALOG.filter(
  (f) => f.showInChecklist,
);

/** Sync legacy boolean columns when saving feature array. */
export function legacyFlagsFromFeatures(features: readonly string[]): {
  require_pin_for_void: boolean;
  require_pin_for_refund: boolean;
  require_pin_for_discount: boolean;
  require_pin_for_cash_drawer: boolean;
} {
  const set = new Set(features);
  return {
    require_pin_for_void: set.has("pin.feature.cancel_invoices"),
    require_pin_for_refund: set.has("pin.feature.issue_refunds"),
    require_pin_for_discount:
      set.has("pin.feature.apply_discounts") || set.has("pin.feature.manage_discounts"),
    require_pin_for_cash_drawer: set.has("pin.feature.cash_drawer"),
  };
}
