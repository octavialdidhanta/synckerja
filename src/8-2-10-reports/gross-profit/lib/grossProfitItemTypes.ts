export type GrossProfitItemRow = {
  catalogProductId: string | null;
  catalogVariantId: string | null;
  productName: string;
  variantName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  qty: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  cogsIncomplete: boolean;
  cogsEstimated: boolean;
};

export const GROSS_PROFIT_ITEMS_TOP_N = 50;
