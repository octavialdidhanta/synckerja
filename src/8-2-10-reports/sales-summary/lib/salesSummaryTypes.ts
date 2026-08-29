export type SalesSummaryMetrics = {
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  gratuity: number;
  tax: number;
  rounding: number;
  totalCollected: number;
  transactionCount: number;
};

export const EMPTY_SALES_SUMMARY: SalesSummaryMetrics = {
  grossSales: 0,
  discounts: 0,
  refunds: 0,
  netSales: 0,
  gratuity: 0,
  tax: 0,
  rounding: 0,
  totalCollected: 0,
  transactionCount: 0,
};

export type SalesSummaryDatePresetId =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom";

export type SalesSummaryDateRange = {
  from: string;
  to: string;
  preset: SalesSummaryDatePresetId;
};

export type SalesSummaryTimeFilter = {
  allDay: boolean;
  /** HH:mm when allDay is false */
  startTime: string;
  /** HH:mm when allDay is false */
  endTime: string;
};

export const SALES_SUMMARY_DEFAULT_START_TIME = "00:00";
export const SALES_SUMMARY_DEFAULT_END_TIME = "23:59";
