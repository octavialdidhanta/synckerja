/** Shared PIN feature keys (Office catalog + mobile policy). */
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

export const POS_PIN_FEATURES = {
  printBill: "pin.feature.print_bill",
  manageOpenBills: "pin.feature.manage_open_bills",
  applyDiscounts: "pin.feature.apply_discounts",
  manageDiscounts: "pin.feature.manage_discounts",
  issueRefunds: "pin.feature.issue_refunds",
  resendReceipts: "pin.feature.resend_receipts",
  recordInvoicePayments: "pin.feature.record_invoice_payments",
  cancelInvoices: "pin.feature.cancel_invoices",
  viewShiftHistory: "pin.feature.view_shift_history",
  editCustomerInformation: "pin.feature.edit_customer_information",
  viewActivity: "pin.feature.view_activity",
  cashDrawer: "pin.feature.cash_drawer",
} as const satisfies Record<string, PosPinFeatureKey>;
