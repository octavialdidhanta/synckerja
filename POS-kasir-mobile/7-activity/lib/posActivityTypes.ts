export type PosActivityPaymentMethod = "cash" | "bank_transfer" | "e_wallet" | string;

export type PosActivityListRow = {
  id: string;
  created_at: string;
  date: string | null;
  total_amount: number;
  total_paid_amount: number;
  payment_method: PosActivityPaymentMethod | null;
  client_name: string | null;
  client_phone: string | null;
  lead_id: string | null;
  checkout_subtotal: number | null;
  checkout_tax_amount: number | null;
  checkout_gratuity_amount: number | null;
  cash_tendered: number | null;
  payment_reference: string | null;
  refund_status: "none" | "full" | string;
  refund_amount: number;
  /** Joined summary of line item names for list subtitle. */
  itemSummary: string;
};

export type PosActivityItem = {
  id: string;
  service_name: string | null;
  sub_service_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type PosActivityDetail = PosActivityListRow & {
  catalog_sales_type_id: string | null;
  items: PosActivityItem[];
};

export type PosActivityProductSubLine = {
  key: string;
  label: string;
  amountRp: number;
  kind: "modifier" | "discount" | "note";
};

export type PosActivityProductLine = {
  key: string;
  title: string;
  subtitle: string | null;
  quantity: number;
  amountRp: number;
  children: PosActivityProductSubLine[];
};

export type PosActivityProductGroup = {
  key: string;
  salesTypeId: string | null;
  salesTypeName: string;
  badge: string;
  lines: PosActivityProductLine[];
};

export type PosActivityDateGroup = {
  key: string;
  /** i18n key for today/yesterday, or null when using formattedLabel */
  labelKind: "today" | "yesterday" | "date";
  /** ISO date yyyy-mm-dd for dateKind === date */
  dateIso: string;
  rows: PosActivityListRow[];
  /** Sum of list amounts for the day (same basis as each row). */
  totalAmount: number;
};

export const POS_ACTIVITY_PAGE_SIZE = 40;
export const POS_ACTIVITY_QUERY_KEY = "pos-outlet-activities";
