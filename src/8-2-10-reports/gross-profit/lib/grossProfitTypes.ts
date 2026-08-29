export type GrossProfitMetrics = {
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  productNetSales: number;
  nonProductNet: number;
  gratuity: number;
  tax: number;
  cogs: number;
  cogsAdjustment: number;
  cogsReversed: number;
  grossProfit: number;
  grossProfitMargin: number;
  cogsIncomplete: boolean;
  transactionCount: number;
};

export const EMPTY_GROSS_PROFIT: GrossProfitMetrics = {
  grossSales: 0,
  discounts: 0,
  refunds: 0,
  netSales: 0,
  productNetSales: 0,
  nonProductNet: 0,
  gratuity: 0,
  tax: 0,
  cogs: 0,
  cogsAdjustment: 0,
  cogsReversed: 0,
  grossProfit: 0,
  grossProfitMargin: 0,
  cogsIncomplete: false,
  transactionCount: 0,
};
