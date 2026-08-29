export const REPORTS_BASE_PATH = "/operations/reports";

/** Sales report sub-routes (left sidebar under Sales tab). */
export const REPORTS_SALES_SUMMARY_PATH = "/operations/reports/sales/summary";
export const REPORTS_SALES_GROSS_PROFIT_PATH = "/operations/reports/sales/gross-profit";
export const REPORTS_SALES_PAYMENT_METHODS_PATH = "/operations/reports/sales/payment-methods";
export const REPORTS_SALES_SALES_TYPE_PATH = "/operations/reports/sales/sales-type";
export const REPORTS_SALES_ITEM_SALES_PATH = "/operations/reports/sales/item-sales";
export const REPORTS_SALES_CATEGORY_SALES_PATH = "/operations/reports/sales/category-sales";
export const REPORTS_SALES_BRAND_SALES_PATH = "/operations/reports/sales/brand-sales";
export const REPORTS_SALES_MODIFIER_SALES_PATH = "/operations/reports/sales/modifier-sales";
export const REPORTS_SALES_DISCOUNTS_PATH = "/operations/reports/sales/discounts";
export const REPORTS_SALES_TAXES_PATH = "/operations/reports/sales/taxes";
export const REPORTS_SALES_GRATUITY_PATH = "/operations/reports/sales/gratuity";
export const REPORTS_SALES_COLLECTED_BY_PATH = "/operations/reports/sales/collected-by";
export const REPORTS_SALES_SERVED_BY_PATH = "/operations/reports/sales/served-by";

export const REPORTS_TRANSACTIONS_PATH = "/operations/reports/transactions";
export const REPORTS_INVOICES_PATH = "/operations/reports/invoices";
export const REPORTS_SHIFT_PATH = "/operations/reports/shift";

export type ReportsSubTab = "sales" | "transactions" | "invoices" | "shift";

export type ReportsSalesNavId =
  | "summary"
  | "gross-profit"
  | "payment-methods"
  | "sales-type"
  | "item-sales"
  | "category-sales"
  | "brand-sales"
  | "modifier-sales"
  | "discounts"
  | "taxes"
  | "gratuity"
  | "collected-by"
  | "served-by";

export const REPORTS_SALES_NAV_PATHS: Record<ReportsSalesNavId, string> = {
  summary: REPORTS_SALES_SUMMARY_PATH,
  "gross-profit": REPORTS_SALES_GROSS_PROFIT_PATH,
  "payment-methods": REPORTS_SALES_PAYMENT_METHODS_PATH,
  "sales-type": REPORTS_SALES_SALES_TYPE_PATH,
  "item-sales": REPORTS_SALES_ITEM_SALES_PATH,
  "category-sales": REPORTS_SALES_CATEGORY_SALES_PATH,
  "brand-sales": REPORTS_SALES_BRAND_SALES_PATH,
  "modifier-sales": REPORTS_SALES_MODIFIER_SALES_PATH,
  discounts: REPORTS_SALES_DISCOUNTS_PATH,
  taxes: REPORTS_SALES_TAXES_PATH,
  gratuity: REPORTS_SALES_GRATUITY_PATH,
  "collected-by": REPORTS_SALES_COLLECTED_BY_PATH,
  "served-by": REPORTS_SALES_SERVED_BY_PATH,
};

export function reportsTabFromPathname(pathname: string): ReportsSubTab {
  if (pathname.startsWith(REPORTS_TRANSACTIONS_PATH)) return "transactions";
  if (pathname.startsWith(REPORTS_INVOICES_PATH)) return "invoices";
  if (pathname.startsWith(REPORTS_SHIFT_PATH)) return "shift";
  return "sales";
}

export function reportsTabPath(tab: ReportsSubTab): string {
  if (tab === "transactions") return REPORTS_TRANSACTIONS_PATH;
  if (tab === "invoices") return REPORTS_INVOICES_PATH;
  if (tab === "shift") return REPORTS_SHIFT_PATH;
  return REPORTS_SALES_SUMMARY_PATH;
}

export function reportsSalesNavFromPathname(pathname: string): ReportsSalesNavId {
  if (pathname.startsWith(REPORTS_SALES_GROSS_PROFIT_PATH)) return "gross-profit";
  if (pathname.startsWith(REPORTS_SALES_PAYMENT_METHODS_PATH)) return "payment-methods";
  if (pathname.startsWith(REPORTS_SALES_SALES_TYPE_PATH)) return "sales-type";
  if (pathname.startsWith(REPORTS_SALES_ITEM_SALES_PATH)) return "item-sales";
  if (pathname.startsWith(REPORTS_SALES_CATEGORY_SALES_PATH)) return "category-sales";
  if (pathname.startsWith(REPORTS_SALES_BRAND_SALES_PATH)) return "brand-sales";
  if (pathname.startsWith(REPORTS_SALES_MODIFIER_SALES_PATH)) return "modifier-sales";
  if (pathname.startsWith(REPORTS_SALES_DISCOUNTS_PATH)) return "discounts";
  if (pathname.startsWith(REPORTS_SALES_TAXES_PATH)) return "taxes";
  if (pathname.startsWith(REPORTS_SALES_GRATUITY_PATH)) return "gratuity";
  if (pathname.startsWith(REPORTS_SALES_COLLECTED_BY_PATH)) return "collected-by";
  if (pathname.startsWith(REPORTS_SALES_SERVED_BY_PATH)) return "served-by";
  return "summary";
}

export function reportsTabLocation(
  path: string,
  search: string,
): { pathname: string; search: string } {
  return { pathname: path, search };
}
