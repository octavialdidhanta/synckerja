export type DiscountSalesMetrics = {
  timesApplied: number;
  grossDiscount: number;
  refundAmount: number;
  netDiscount: number;
};

export type DiscountSalesDiscountRow = DiscountSalesMetrics & {
  catalogDiscountId: string | null;
  discountName: string;
  sortOrder: number;
};

export type DiscountSalesValueRow = DiscountSalesMetrics & {
  catalogDiscountId: string | null;
  discountName: string;
  discountSortOrder: number;
  valueLabel: string;
  valueSortOrder: number;
};

export type DiscountSalesDisplayRow =
  | ({ rowKind: "discount" } & DiscountSalesDiscountRow)
  | ({ rowKind: "value" } & DiscountSalesValueRow);

export type DiscountSalesTotals = DiscountSalesMetrics;

export type DiscountSalesDisplay = {
  discounts: DiscountSalesDiscountRow[];
  values: DiscountSalesValueRow[];
  displayRows: DiscountSalesDisplayRow[];
  grandTotal: DiscountSalesTotals;
  summaryTotalNetDiscount: number;
};

export const EMPTY_DISCOUNT_SALES_DISPLAY: DiscountSalesDisplay = {
  discounts: [],
  values: [],
  displayRows: [],
  grandTotal: {
    timesApplied: 0,
    grossDiscount: 0,
    refundAmount: 0,
    netDiscount: 0,
  },
  summaryTotalNetDiscount: 0,
};

export type DiscountSalesSortKey =
  | "discountName"
  | "timesApplied"
  | "grossDiscount"
  | "refundAmount"
  | "netDiscount";

export type DiscountSalesSortDir = "asc" | "desc";
